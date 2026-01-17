import { DurableAgent } from "@workflow/ai/agent";
import { getWritable } from "workflow";
import type { ModelMessage } from "ai";
// Use WDK provider wrappers - they handle serialization correctly via "use step"
import { anthropic } from "@workflow/ai/anthropic";
import { openai } from "@workflow/ai/openai";
import { google } from "@workflow/ai/google";
// Raw AI SDK providers - for custom API keys and tools
import { anthropic as anthropicRaw, createAnthropic } from "@ai-sdk/anthropic";
import { openai as openaiRaw, createOpenAI } from "@ai-sdk/openai";
import { google as googleRaw, createGoogleGenerativeAI } from "@ai-sdk/google";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { getModelInfo, type Model } from "@/lib/models";
import { Langfuse } from "langfuse";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// ============================================================================
// Types
// ============================================================================

export interface ChatWorkflowConfig {
  model: string;
  userId: string;
  conversationId: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  reasoningLevel?: string | number;
  webSearchEnabled?: boolean;
  useCustomKey?: boolean;
  customApiKey?: string;
  tier?: string;
}

interface WebSearchSource {
  title?: string;
  url?: string;
  uri?: string;
  snippet?: string;
}

type ProviderOptions =
  | { anthropic: { thinking: { type: "enabled"; budgetTokens: number } } }
  | { openai: { reasoningEffort: string } }
  | {
      google: {
        thinkingConfig: { thinkingLevel: string; includeThoughts: boolean };
      };
    }
  | undefined;

// ============================================================================
// Helper Functions
// ============================================================================

// Build model using WDK providers (returns () => Promise<LanguageModel> for serialization)
// For custom API keys, we wrap the raw providers in the same pattern
function buildModel(modelInfo: Model, customApiKey?: string) {
  if (customApiKey) {
    // Custom API keys: wrap raw providers to match WDK pattern
    switch (modelInfo.provider) {
      case "anthropic":
        return async () => {
          "use step";
          return createAnthropic({ apiKey: customApiKey })(
            modelInfo.apiModelId
          );
        };
      case "openai":
        return async () => {
          "use step";
          return createOpenAI({ apiKey: customApiKey })(modelInfo.apiModelId);
        };
      case "google":
        return async () => {
          "use step";
          return createGoogleGenerativeAI({ apiKey: customApiKey })(
            modelInfo.apiModelId
          );
        };
    }
  }

  // Default: use WDK provider wrappers (already have "use step" built-in)
  switch (modelInfo.provider) {
    case "anthropic":
      return anthropic(modelInfo.apiModelId);
    case "openai":
      return openai(modelInfo.apiModelId);
    case "google":
      return google(modelInfo.apiModelId);
    default:
      throw new Error(`Unknown provider: ${modelInfo.provider}`);
  }
}

// Build provider-specific web search tools using raw AI SDK providers
// (WDK only wraps models, not tools - tools need the raw providers)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildWebSearchTools(
  provider: string
): Record<string, any> | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openaiAny = openaiRaw as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const googleAny = googleRaw as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anthropicAny = anthropicRaw as any;

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

// Build provider options for reasoning models
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
    return {
      openai: {
        reasoningEffort: reasoningLevel as string,
      },
    };
  } else if (provider === "google" && reasoningKind === "effort") {
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

// ============================================================================
// Main Workflow
// ============================================================================

export async function chatWorkflow(
  messages: ModelMessage[],
  config: ChatWorkflowConfig
) {
  "use workflow";

  const writable = getWritable();
  const modelInfo = getModelInfo(config.model);

  // Build tools - web search is provider-specific
  const tools = config.webSearchEnabled
    ? buildWebSearchTools(modelInfo.provider)
    : undefined;

  // Build provider options for reasoning
  const useReasoning =
    modelInfo.reasoningParameter &&
    config.reasoningLevel !== undefined &&
    config.reasoningLevel !== "off";

  const providerOptions = buildProviderOptions(
    modelInfo.provider,
    config.reasoningLevel,
    modelInfo.reasoningParameter?.kind
  );

  // Build headers for interleaved thinking (anthropic only)
  const headers: Record<string, string> | undefined =
    modelInfo.provider === "anthropic" && useReasoning
      ? { "anthropic-beta": "interleaved-thinking-2025-05-14" }
      : undefined;

  // Build model using WDK provider wrappers (returns () => Promise<LanguageModel>)
  // These are serializable because they use "use step" internally
  const model = buildModel(modelInfo, config.customApiKey);

  const agent = new DurableAgent({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: model as any,
    system: config.systemPrompt || "You are a helpful assistant.",
    temperature: config.temperature ?? 1,
    maxOutputTokens: config.maxTokens,
    tools,
    providerOptions,
    headers,
  });

  // Track accumulated text for Langfuse
  let accumulatedText = "";

  const result = await agent.stream({
    messages,
    writable,
    onFinish: async ({ steps }) => {
      // Extract token counts from the last step's usage and provider metadata
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lastStep = steps[steps.length - 1] as any;
      const usage = lastStep?.usage;
      const providerMetadata = lastStep?.response?.providerMetadata;

      let inputTokens = 0;
      let outputTokens = 0;

      // Helper to safely extract a number value
      const toNumber = (val: unknown): number => {
        if (typeof val === "number" && !isNaN(val)) return val;
        if (typeof val === "string") {
          const parsed = parseFloat(val);
          return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
      };

      if (
        modelInfo.provider === "anthropic" &&
        providerMetadata?.anthropic?.usage
      ) {
        const anthropicUsage = providerMetadata.anthropic.usage;
        inputTokens = toNumber(anthropicUsage.input_tokens);
        outputTokens = toNumber(anthropicUsage.output_tokens);
      } else if (
        modelInfo.provider === "google" &&
        providerMetadata?.google?.usageMetadata
      ) {
        const googleUsage = providerMetadata.google.usageMetadata;
        const totalTokens = toNumber(googleUsage.totalTokenCount);
        const candidatesTokens = toNumber(googleUsage.candidatesTokenCount);
        const thoughtsTokens = toNumber(googleUsage.thoughtsTokenCount);
        inputTokens = totalTokens - candidatesTokens - thoughtsTokens;
        outputTokens = candidatesTokens + thoughtsTokens;
      } else if (
        modelInfo.provider === "openai" &&
        providerMetadata?.openai?.usage
      ) {
        const openaiUsage = providerMetadata.openai.usage;
        inputTokens = toNumber(
          openaiUsage.prompt_tokens ?? openaiUsage.input_tokens
        );
        outputTokens = toNumber(
          openaiUsage.completion_tokens ?? openaiUsage.output_tokens
        );
      } else if (usage) {
        // Try standard AI SDK usage object
        inputTokens = toNumber(usage.inputTokens ?? usage.promptTokens);
        outputTokens = toNumber(usage.outputTokens ?? usage.completionTokens);
      } else if (Array.isArray(steps) && steps.length > 0) {
        // Fallback: sum across all steps
        for (const s of steps) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const stepUsage = (s as any).usage;
          if (stepUsage) {
            inputTokens += toNumber(
              stepUsage.inputTokens ?? stepUsage.promptTokens
            );
            outputTokens += toNumber(
              stepUsage.outputTokens ?? stepUsage.completionTokens
            );
          }
        }
      }

      // Single token write at completion - replaces 1-second polling!
      await finalizeTokens({
        conversationId: config.conversationId,
        userId: config.userId,
        model: config.model,
        inputTokens,
        outputTokens,
        usedOwnKey: config.useCustomKey ?? false,
      });

      // Save web search sources to the assistant message (extract from steps)
      if (config.webSearchEnabled) {
        // Collect sources from all steps
        const allSources: WebSearchSource[] = [];
        for (const step of steps) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const stepSources =
            (step as any).sources ?? (step as any).response?.sources ?? [];
          allSources.push(...stepSources);
        }
        if (allSources.length > 0) {
          await saveSources({
            conversationId: config.conversationId,
            sources: allSources,
          });
        }
      }

      // Increment free tier message count (production mode only)
      if (config.tier === "free") {
        await incrementFreeUsage({
          userId: config.userId,
        });
      }

      // Send Langfuse trace for observability
      await sendLangfuseTrace({
        userId: config.userId,
        conversationId: config.conversationId,
        model: config.model,
        provider: modelInfo.provider,
        webSearchEnabled: config.webSearchEnabled ?? false,
        inputTokens,
        outputTokens,
        accumulatedText,
        systemPrompt: config.systemPrompt,
        messages,
      });
    },
    onStepFinish: async (step) => {
      // Track accumulated text for Langfuse
      if (step.text) {
        accumulatedText += step.text;
      }
      console.log(
        `[WDK] Step completed: ${step.usage?.totalTokens ?? 0} tokens`
      );
    },
  });

  return result;
}

// ============================================================================
// Durable Steps
// ============================================================================

async function finalizeTokens(params: {
  conversationId: string;
  userId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  usedOwnKey: boolean;
}) {
  "use step";

  try {
    await convex.mutation(api.messages.updateTokens, {
      conversationId: params.conversationId as any,
      userId: params.userId,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      usedOwnKey: params.usedOwnKey,
      serverSecret: process.env.CHAT_AUTH_SECRET!,
    });
  } catch (err) {
    console.error("[WDK] Failed to finalize tokens:", err);
  }
}

async function saveSources(params: {
  conversationId: string;
  sources: WebSearchSource[];
}) {
  "use step";

  try {
    const mappedSources = params.sources
      .filter((s) => s.url || s.uri)
      .map((s) => ({
        title: s.title || s.url || s.uri || "Source",
        url: s.url || s.uri || "",
        snippet: s.snippet || undefined,
      }));

    if (mappedSources.length > 0) {
      await convex.mutation(api.messages.addSourcesToLastAssistant, {
        conversationId: params.conversationId as any,
        sources: mappedSources,
      });
    }
  } catch (err) {
    console.error("[WDK] Failed to save sources:", err);
  }
}

async function incrementFreeUsage(params: { userId: string }) {
  "use step";

  try {
    await convex.mutation(api.freeUsage.incrementFreeUsageInternal, {
      userId: params.userId,
      serverSecret: process.env.CHAT_AUTH_SECRET!,
    });
  } catch (err) {
    console.error("[WDK] Failed to increment free usage:", err);
  }
}

async function sendLangfuseTrace(params: {
  userId: string;
  conversationId: string;
  model: string;
  provider: string;
  webSearchEnabled: boolean;
  inputTokens: number;
  outputTokens: number;
  accumulatedText: string;
  systemPrompt?: string;
  messages: ModelMessage[];
}) {
  "use step";

  try {
    // Sanitize content to avoid sending large base64 payloads
    const sanitizeContent = (
      content: string | Array<{ type: string; [key: string]: unknown }>
    ): string => {
      if (typeof content === "string") return content;
      return content
        .map((part) => {
          if (part.type === "text") return part.text as string;
          if (part.type === "image")
            return `[image: ${(part.mimeType as string) || "unknown type"}]`;
          if (part.type === "file")
            return `[file: ${(part.filename as string) || "document"}, ${part.mediaType as string}]`;
          return `[${part.type}]`;
        })
        .join("\n");
    };

    const langfuseMessages = [
      {
        role: "system" as const,
        content: params.systemPrompt || "You are a helpful assistant.",
      },
      ...params.messages.map((msg) => ({
        role: msg.role,
        content: sanitizeContent(
          msg.content as
            | string
            | Array<{ type: string; [key: string]: unknown }>
        ),
      })),
    ];

    const langfuse = new Langfuse();
    const trace = langfuse.trace({
      name: "chat-request",
      userId: params.userId,
      metadata: {
        conversationId: params.conversationId,
        provider: params.provider,
        webSearchEnabled: params.webSearchEnabled,
        durable: true, // Mark as WDK-powered
      },
    });

    trace.generation({
      name: "chat-completion",
      model: params.model,
      input: langfuseMessages,
      output: params.accumulatedText,
      usage: {
        input: params.inputTokens,
        output: params.outputTokens,
        total: params.inputTokens + params.outputTokens,
      },
    });

    await langfuse.flushAsync();
  } catch (err) {
    console.error("[WDK] Failed to send Langfuse trace:", err);
  }
}
