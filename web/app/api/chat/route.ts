import { ModelMessage, createUIMessageStreamResponse } from "ai";
import { start } from "workflow/api";
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
import { chatWorkflow } from "@/app/workflows/chat";

// ============================================================================
// constants
// ============================================================================

/** timeout for fetching files (images, pDFs) in milliseconds */
const FILE_FETCH_TIMEOUT_MS = 30000;

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
): Promise<ModelMessage[]> {
  const converted: ModelMessage[] = [];

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

    // Start durable workflow - this replaces streamText() + token interval
    // WDK handles:
    // - Durability (survives tab close, crashes, deploys)
    // - Token tracking (single write at completion, not 1-second polling)
    // - Stream resumption (clients can reconnect)
    const run = await start(chatWorkflow, [
      coreMessages,
      {
        model: requestedModel,
        userId,
        conversationId,
        systemPrompt,
        reasoningLevel,
        webSearchEnabled: shouldUseWebSearch,
        useCustomKey,
        customApiKey: customApiKey || undefined,
        tier: tier.tier,
      },
    ]);

    // Return stream with run ID header for client resumption
    // Use createUIMessageStreamResponse to properly format the WDK stream
    return createUIMessageStreamResponse({
      stream: run.readable,
      headers: {
        "x-workflow-run-id": run.runId,
      },
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
