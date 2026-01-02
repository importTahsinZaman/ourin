import { streamText, CoreMessage } from "ai";
import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { google, createGoogleGenerativeAI } from "@ai-sdk/google";
import { verifyChatToken, extractChatToken } from "@/lib/verifyChatToken";
import { getModelInfo, FREE_MODEL_ID } from "@/lib/models";
import { decryptApiKey } from "@/lib/encryption";
import { fetchAndProcessImage } from "@/lib/imageProcessing";
import { IS_SELF_HOSTING } from "@/lib/config";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { getEncoding } from "js-tiktoken";
import { updateActiveTrace } from "@langfuse/tracing";

// ============================================================================
// constants
// ============================================================================

/** timeout for fetching files (images, pDFs) in milliseconds */
const FILE_FETCH_TIMEOUT_MS = 30000;

/** estimated tokens added per message for structure overhead */
const TOKENS_PER_MESSAGE_OVERHEAD = 4;

/** estimated tokens for web search tool definitions */
const TOOL_DEFINITION_TOKENS = 1500;

/** estimated tokens per image (conservative estimate for vision models) */
const TOKENS_PER_IMAGE = 4000;

/** interval for tracking token usage during streaming (ms) */
const TOKEN_TRACKING_INTERVAL_MS = 1000;

/** time to wait for onFinish after abort before tracking partial tokens (ms) */
const ABORT_SETTLE_MS = 100;

// ============================================================================
// token encoding
// ============================================================================

// get tiktoken encoder - cl100k_base works well for most modern models
// (gPT-4, gPT-3.5-turbo, and is a reasonable approximation for claude/gemini)
let tiktokenEncoder: ReturnType<typeof getEncoding> | null = null;
function getTokenEncoder() {
  if (!tiktokenEncoder) {
    tiktokenEncoder = getEncoding("cl100k_base");
  }
  return tiktokenEncoder;
}

// count tokens using tiktoken
function countTokens(text: string): number {
  try {
    const encoder = getTokenEncoder();
    return encoder.encode(text).length;
  } catch {
    // fallback to rough estimate if tiktoken fails
    return Math.ceil(text.length / 4);
  }
}

// initialize convex client
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// default provider registry (uses env vars)
const defaultProviders: Record<
  string,
  (apiModelId: string) => ReturnType<typeof anthropic>
> = {
  anthropic: (apiModelId: string) => anthropic(apiModelId),
  openai: (apiModelId: string) =>
    openai(apiModelId) as unknown as ReturnType<typeof anthropic>,
  google: (apiModelId: string) =>
    google(apiModelId) as unknown as ReturnType<typeof anthropic>,
};

// create provider with custom aPI key
function createProviderWithKey(
  provider: string,
  apiKey: string,
  apiModelId: string
) {
  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey })(apiModelId);
    case "openai":
      return createOpenAI({ apiKey })(apiModelId) as unknown as ReturnType<
        typeof anthropic
      >;
    case "google":
      return createGoogleGenerativeAI({ apiKey })(
        apiModelId
      ) as unknown as ReturnType<typeof anthropic>;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

function getModel(modelId: string) {
  const modelInfo = getModelInfo(modelId);
  const providerFn = defaultProviders[modelInfo.provider];
  if (!providerFn) {
    throw new Error(`Unknown provider: ${modelInfo.provider}`);
  }
  return providerFn(modelInfo.apiModelId);
}

// check if a mIME type is an image
function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

// check if a mIME type is a supported document (pDF)
function isPdfMimeType(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; image: string; mimeType?: string }
  | { type: "file"; data: string; mediaType: string; filename?: string };

/** provider-specific options for reasoning models */
type ProviderOptions =
  | { anthropic: { thinking: { type: "enabled"; budgetTokens: number } } }
  | { openai: { reasoningEffort: string } }
  | {
      google: {
        thinkingConfig: { thinkingLevel: string; includeThoughts: boolean };
      };
    }
  | undefined;

/** token usage from aI sDK (handles different property names across versions) */
interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
}

/** web search source from aI sDK providers */
interface WebSearchSource {
  title?: string;
  url?: string;
  uri?: string;
  snippet?: string;
}

// fetch file and convert to base64 (for pDFs and other non-image files)
async function fetchFileAsBase64(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FILE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer).toString("base64");
  } finally {
    clearTimeout(timeout);
  }
}

// build web search tools based on provider

function buildWebSearchTools(
  provider: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- web search tools have dynamic structure per provider
): Record<string, any> | undefined {
  // note: web search tools require newer sDK versions that may not have typeScript types yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openaiAny = openai as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const googleAny = google as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anthropicAny = anthropic as any;

  switch (provider) {
    case "openai":
      return {
        web_search: openaiAny.tools.webSearchPreview({
          searchContextSize: "high",
        }),
      };
    case "google":
      return {
        google_search: googleAny.tools.googleSearch({}),
      };
    case "anthropic":
      return {
        web_search: anthropicAny.tools.webSearch_20250305({
          maxUses: 5,
        }),
      };
    default:
      return undefined;
  }
}

// build provider options for reasoning models
function buildProviderOptions(
  provider: string,
  reasoningLevel: string | number | undefined,
  reasoningKind: "budget" | "effort" | undefined
): ProviderOptions {
  if (
    !reasoningKind ||
    reasoningLevel === undefined ||
    reasoningLevel === "off"
  ) {
    return undefined;
  }

  if (provider === "anthropic" && reasoningKind === "budget") {
    // anthropic extended thinking
    return {
      anthropic: {
        thinking: {
          type: "enabled",
          budgetTokens:
            typeof reasoningLevel === "number" ? reasoningLevel : 8000,
        },
      },
    };
  } else if (provider === "openai" && reasoningKind === "effort") {
    // openAI reasoning effort
    return {
      openai: {
        reasoningEffort: reasoningLevel as string,
      },
    };
  } else if (provider === "google" && reasoningKind === "effort") {
    // google gemini thinking config
    return {
      google: {
        thinkingConfig: {
          thinkingLevel: reasoningLevel as string,
          includeThoughts: true,
        },
      },
    };
  }

  return undefined;
}

// process a single file part into a contentPart
async function processFilePart(
  part: { mediaType: string; url: string; fileName?: string },
  provider: string
): Promise<ContentPart> {
  if (isImageMimeType(part.mediaType)) {
    try {
      const { base64, mimeType } = await fetchAndProcessImage(
        part.url,
        part.mediaType,
        provider,
        part.fileName
      );
      return { type: "image", image: base64, mimeType };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`Failed to process image ${part.fileName}:`, errorMsg);
      return { type: "text", text: `[Image failed to load: ${part.fileName}]` };
    }
  } else if (isPdfMimeType(part.mediaType)) {
    try {
      const base64Data = await fetchFileAsBase64(part.url);
      return {
        type: "file",
        data: base64Data,
        mediaType: part.mediaType,
        filename: part.fileName,
      };
    } catch (err) {
      console.error("Failed to fetch PDF:", err);
      return {
        type: "text",
        text: `[Failed to load PDF: ${part.fileName || "document"}]`,
      };
    }
  } else {
    return {
      type: "text",
      text: `[Attached file: ${part.fileName || "document"}]`,
    };
  }
}

// convert our message format to coreMessage format with proper multimodal support
async function convertMessages(
  messages: Array<{
    id: string;
    role: string;
    parts: Array<{
      type: string;
      text?: string;
      mediaType?: string;
      url?: string;
      fileName?: string;
    }>;
  }>,
  provider: string
): Promise<CoreMessage[]> {
  const converted: CoreMessage[] = [];

  for (const msg of messages) {
    // for assistant messages, just extract text
    if (msg.role === "assistant") {
      const text = msg.parts
        .filter((p) => p.type === "text")
        .map((p) => p.text || "")
        .join("");
      converted.push({ role: "assistant", content: text });
      continue;
    }

    // skip system messages in conversation (handled separately)
    if (msg.role === "system") {
      continue;
    }

    // for user messages, build multimodal content
    // collect text parts immediately, file parts need async processing
    const textParts: ContentPart[] = [];
    const filePartPromises: Array<{
      index: number;
      promise: Promise<ContentPart>;
    }> = [];

    msg.parts.forEach((part, index) => {
      if (part.type === "text" && part.text) {
        textParts.push({ type: "text", text: part.text });
      } else if (part.type === "file" && part.url && part.mediaType) {
        // process files in parallel
        filePartPromises.push({
          index,
          promise: processFilePart(
            {
              mediaType: part.mediaType,
              url: part.url,
              fileName: part.fileName,
            },
            provider
          ),
        });
      }
    });

    // wait for all file parts to be processed in parallel
    const resolvedFileParts = await Promise.all(
      filePartPromises.map(async ({ index, promise }) => ({
        index,
        part: await promise,
      }))
    );

    // combine text and file parts, maintaining original order
    const contentParts: ContentPart[] = [];
    let textPartIdx = 0;
    let filePartIdx = 0;
    const sortedFileParts = resolvedFileParts.sort((a, b) => a.index - b.index);

    msg.parts.forEach((part) => {
      if (part.type === "text" && part.text) {
        contentParts.push(textParts[textPartIdx++]);
      } else if (part.type === "file" && part.url && part.mediaType) {
        contentParts.push(sortedFileParts[filePartIdx++].part);
      }
    });

    if (contentParts.length === 0) {
      contentParts.push({ type: "text", text: "" });
    }

    // use type assertion for content due to aI sDK v5 type changes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    converted.push({ role: "user", content: contentParts as any });
  }

  return converted;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      messages,
      model,
      systemPrompt,
      conversationId,
      reasoningLevel,
      webSearchEnabled,
    } = body;

    // extract token from authorization header (preferred) or body (fallback)
    const chatToken =
      extractChatToken(req) || (body.chatToken as string | undefined);

    if (!chatToken) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - no token provided" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const tokenResult = await verifyChatToken(chatToken);
    if (!tokenResult.valid || !tokenResult.userId) {
      const errorMessage =
        tokenResult.error === "expired"
          ? "Unauthorized - token expired"
          : tokenResult.error === "invalid_signature"
            ? "Unauthorized - invalid token signature"
            : tokenResult.error === "malformed_token"
              ? "Unauthorized - malformed token"
              : "Unauthorized - invalid token";

      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = tokenResult.userId;

    const requestedModel = model || FREE_MODEL_ID;
    const modelInfo = getModelInfo(requestedModel);

    // get user tier - all users (including anonymous) have real iDs now
    let useCustomKey = false;
    let customApiKey: string | null = null;
    let tier: { tier: string; canSendMessage: boolean; providers?: string[] };

    // in self-hosting mode, skip billing checks - all models allowed
    if (IS_SELF_HOSTING) {
      tier = { tier: "self_hosted", canSendMessage: true };
    } else {
      // production mode: full tier checking
      tier = await convex.query(api.billing.getUserTierById, { userId });

      // check model access based on tier
      if (tier.tier === "free") {
        // free users can only use the free model
        if (requestedModel !== FREE_MODEL_ID) {
          return new Response(
            JSON.stringify({
              error: "Model not available",
              code: "MODEL_RESTRICTED",
              details:
                "Free users can only use Gemini 2.5 Flash Lite. Subscribe to access other models.",
            }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }

        // check message limit
        if (!tier.canSendMessage) {
          return new Response(
            JSON.stringify({
              error: "Message limit reached",
              code: "FREE_LIMIT_REACHED",
              details:
                "You've reached the free message limit. Subscribe to continue.",
            }),
            { status: 402, headers: { "Content-Type": "application/json" } }
          );
        }
      } else if (tier.tier === "subscriber") {
        // subscribers can use all models
        // check if user has their own aPI key for this provider (bYOK - subscriber benefit)
        if (tier.providers?.includes(modelInfo.provider)) {
          // get the user's aPI key for this provider
          const encryptedKey = await convex.query(api.apiKeys.getEncryptedKey, {
            provider: modelInfo.provider,
          });

          if (encryptedKey) {
            try {
              customApiKey = await decryptApiKey(encryptedKey);
              useCustomKey = true;
            } catch (err) {
              console.error("Failed to decrypt API key:", err);
              return new Response(
                JSON.stringify({
                  error: "Failed to decrypt API key",
                  code: "KEY_DECRYPT_ERROR",
                  details: "Please re-enter your API key in settings.",
                }),
                { status: 500, headers: { "Content-Type": "application/json" } }
              );
            }
          }
        }

        // if not using own key, check credits
        if (!useCustomKey && !tier.canSendMessage) {
          return new Response(
            JSON.stringify({
              error: "Credits depleted",
              code: "CREDITS_DEPLETED",
              details:
                "You've used all your credits. Purchase more credits to continue.",
            }),
            { status: 402, headers: { "Content-Type": "application/json" } }
          );
        }
      }
    }

    // web search: in self-hosting mode allow if model supports it, in production require subscriber tier
    const canUseWebSearch = IS_SELF_HOSTING
      ? modelInfo.supportsWebSearch
      : tier.tier === "subscriber" && modelInfo.supportsWebSearch;
    const shouldUseWebSearch = webSearchEnabled === true && canUseWebSearch;

    // convert messages to coreMessage format (images auto-resized to fit provider limits)
    const coreMessages = await convertMessages(messages, modelInfo.provider);

    // update langfuse trace with session and user info
    if (conversationId) {
      updateActiveTrace({
        sessionId: conversationId,
        userId,
        name: "chat-completion",
      });
    }

    // get the appropriate model instance
    let modelInstance;
    if (useCustomKey && customApiKey) {
      modelInstance = createProviderWithKey(
        modelInfo.provider,
        customApiKey,
        modelInfo.apiModelId
      );
    } else {
      modelInstance = getModel(requestedModel);
    }

    // build web search tools and provider options
    const tools = shouldUseWebSearch
      ? buildWebSearchTools(modelInfo.provider)
      : undefined;

    const useReasoning =
      modelInfo.reasoningParameter &&
      reasoningLevel !== undefined &&
      reasoningLevel !== "off";

    const providerOptions = buildProviderOptions(
      modelInfo.provider,
      reasoningLevel,
      modelInfo.reasoningParameter?.kind
    );

    // build headers for interleaved thinking (anthropic only)
    // this allows reasoning tokens to appear between tool calls
    const headers: Record<string, string> | undefined =
      modelInfo.provider === "anthropic" && useReasoning
        ? { "anthropic-beta": "interleaved-thinking-2025-05-14" }
        : undefined;

    // track whether onFinish was called (for abort/interval handling)
    let onFinishCalled = false;
    let accumulatedText = "";
    let cachedInputTokens: number | null = null; // lazy calculation
    let lastTrackedOutputTokens = 0; // avoid redundant updates

    // calculate input tokens lazily (only when first needed)
    const getInputTokens = () => {
      if (cachedInputTokens !== null) return cachedInputTokens;

      let totalTokens = countTokens(
        systemPrompt || "You are a helpful assistant."
      );
      let imageCount = 0;

      for (const msg of coreMessages) {
        if (typeof msg.content === "string") {
          totalTokens += countTokens(msg.content);
        } else if (Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part.type === "text") {
              totalTokens += countTokens(part.text);
            } else if (part.type === "image") {
              imageCount++;
            }
          }
        }
        // add overhead for message structure
        totalTokens += TOKENS_PER_MESSAGE_OVERHEAD;
      }

      // add overhead for tool definitions when web search is enabled
      if (shouldUseWebSearch) {
        totalTokens += TOOL_DEFINITION_TOKENS;
      }

      // add overhead for images
      totalTokens += imageCount * TOKENS_PER_IMAGE;

      cachedInputTokens = totalTokens;
      return totalTokens;
    };

    // set up 1000ms interval for token tracking (non-blocking, first run at 1000ms)
    let tokenTrackingInterval: ReturnType<typeof setInterval> | null = null;
    if (conversationId) {
      tokenTrackingInterval = setInterval(async () => {
        if (onFinishCalled || accumulatedText.length === 0) return;

        const outputTokens = countTokens(accumulatedText);
        // skip if no change since last update
        if (outputTokens === lastTrackedOutputTokens) return;
        lastTrackedOutputTokens = outputTokens;

        const inputTokens = getInputTokens();

        // double-check before mutation to minimize race with onFinish
        if (onFinishCalled) return;

        try {
          await convex.mutation(api.messages.updateTokens, {
            conversationId,
            userId,
            model: requestedModel,
            inputTokens,
            outputTokens,
            usedOwnKey: useCustomKey,
            serverSecret: process.env.CHAT_AUTH_SECRET!,
          });
        } catch (err) {
          console.error("Failed to update token checkpoint:", err);
        }
      }, TOKEN_TRACKING_INTERVAL_MS);
    }

    // cleanup function for interval
    const clearTokenInterval = () => {
      if (tokenTrackingInterval) {
        clearInterval(tokenTrackingInterval);
        tokenTrackingInterval = null;
      }
    };

    // handle abort - track final partial tokens when client disconnects
    const handleAbort = async () => {
      clearTokenInterval();

      // wait a bit to see if onFinish gets called
      await new Promise((resolve) => setTimeout(resolve, ABORT_SETTLE_MS));

      if (!onFinishCalled && accumulatedText.length > 0 && conversationId) {
        const inputTokens = getInputTokens();
        const outputTokens = countTokens(accumulatedText);

        try {
          await convex.mutation(api.messages.updateTokens, {
            conversationId,
            userId,
            model: requestedModel,
            inputTokens,
            outputTokens,
            usedOwnKey: useCustomKey,
            serverSecret: process.env.CHAT_AUTH_SECRET!,
          });
        } catch (err) {
          console.error("Failed to track aborted usage:", err);
        }
      }
    };

    req.signal.addEventListener("abort", handleAbort);

    // stream the response with usage tracking
    // pass request signal so lLM generation is cancelled if client disconnects
    const result = streamText({
      model: modelInstance,
      system: systemPrompt || "You are a helpful assistant.",
      messages: coreMessages,
      providerOptions,
      tools,
      headers,
      abortSignal: req.signal,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "chat-completion",
        metadata: {
          conversationId: conversationId || "unknown",
          userId,
          model: requestedModel,
          webSearchEnabled: shouldUseWebSearch,
        },
      },
      onChunk: ({ chunk }) => {
        // track accumulated text for abort estimation
        if (chunk.type === "text-delta") {
          accumulatedText += chunk.text;
        }
      },
      onError: (error) => {
        console.error("Stream error:", error);
      },
      onFinish: async ({ usage, sources }) => {
        onFinishCalled = true;
        clearTokenInterval(); // stop checkpoint updates, we have exact tokens now
        // track token usage for all users (needed for billing calculations)
        if (usage && conversationId) {
          // cast to tokenUsage because property names vary across sDK versions
          const usageTyped = usage as TokenUsage;
          const inputTokens =
            usageTyped.inputTokens ?? usageTyped.promptTokens ?? 0;
          const outputTokens =
            usageTyped.outputTokens ?? usageTyped.completionTokens ?? 0;

          try {
            // update tokens and automatically deduct purchased credits if needed
            // this is atomic - convex handles subscription balance check and fIFO deduction
            // pass usedOwnKey to skip credit deduction when user's own aPI key was used
            await convex.mutation(api.messages.updateTokens, {
              conversationId,
              userId,
              model: requestedModel,
              inputTokens,
              outputTokens,
              usedOwnKey: useCustomKey,
              serverSecret: process.env.CHAT_AUTH_SECRET!,
            });
          } catch (err) {
            // log error but don't fail the request (usage tracking is best-effort)
            console.error("Failed to track usage:", err);
          }
        }

        // increment free tier message count (production mode only)
        if (!IS_SELF_HOSTING && tier.tier === "free") {
          try {
            await convex.mutation(api.freeUsage.incrementFreeUsageInternal, {
              userId,
              serverSecret: process.env.CHAT_AUTH_SECRET!,
            });
          } catch (err) {
            console.error("Failed to increment free usage:", err);
          }
        }

        // save web search sources to the assistant message
        if (
          shouldUseWebSearch &&
          sources &&
          sources.length > 0 &&
          conversationId
        ) {
          try {
            // cast sources to webSearchSource because structure varies across providers
            const sourcesTyped = sources as WebSearchSource[];
            const mappedSources = sourcesTyped
              .filter((s) => s.url || s.uri) // filter out sources without uRLs
              .map((s) => ({
                title: s.title || s.url || s.uri || "Source",
                url: s.url || s.uri || "",
                snippet: s.snippet || undefined,
              }));

            if (mappedSources.length > 0) {
              await convex.mutation(api.messages.addSourcesToLastAssistant, {
                conversationId,
                sources: mappedSources,
              });
            }
          } catch (err) {
            console.error("Failed to save sources:", err);
          }
        }
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (result as any).toUIMessageStreamResponse({
      sendReasoning: true,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    console.error(
      "Error details:",
      error instanceof Error ? error.stack : String(error)
    );

    // sanitize error message - don't expose internal details to clients
    const isKnownError =
      error instanceof Error &&
      (error.message.includes("rate limit") ||
        error.message.includes("overloaded") ||
        error.message.includes("timeout"));

    return new Response(
      JSON.stringify({
        error: "Failed to process chat request",
        details: isKnownError
          ? error.message
          : "An unexpected error occurred. Please try again.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
