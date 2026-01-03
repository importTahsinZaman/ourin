import type { UIMessage } from "@ourin/shared/types";

const API_VERSION = "v1";

/**
 * Get the base API URL from environment
 */
function getBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) {
    throw new Error(
      "EXPO_PUBLIC_API_URL is required. Check your .env.local file."
    );
  }
  return url;
}

/**
 * API error with structured error data
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Error codes returned by the chat API
 */
export type ChatErrorCode =
  | "MODEL_RESTRICTED"
  | "FREE_LIMIT_REACHED"
  | "CREDITS_DEPLETED"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "UNKNOWN";

/**
 * Chat request options
 */
export interface ChatRequestOptions {
  messages: UIMessage[];
  conversationId: string;
  model: string;
  systemPrompt?: string;
  reasoningLevel?: string;
  webSearchEnabled?: boolean;
}

/**
 * Parsed stream event types
 */
export type StreamEventType =
  | "text-delta"
  | "reasoning-start"
  | "reasoning-delta"
  | "reasoning-end"
  | "tool-input-start"
  | "tool-input-delta"
  | "tool-result"
  | "sources"
  | "error"
  | "done";

export interface StreamEvent {
  type: StreamEventType;
  data: unknown;
}

/**
 * Stream reader callback type
 */
export type StreamCallback = (event: StreamEvent) => void;

/**
 * Send a chat message and stream the response.
 *
 * @param token - Auth token from generateChatToken
 * @param options - Chat request options
 * @param onEvent - Callback for each stream event
 * @param signal - AbortSignal for cancellation
 * @returns Full response text when complete
 */
export async function streamChat(
  token: string,
  options: ChatRequestOptions,
  onEvent: StreamCallback,
  signal?: AbortSignal
): Promise<string> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/${API_VERSION}/chat`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messages: options.messages,
      conversationId: options.conversationId,
      model: options.model,
      systemPrompt: options.systemPrompt,
      reasoningLevel: options.reasoningLevel,
      webSearchEnabled: options.webSearchEnabled ?? false,
    }),
    signal,
  });

  if (!response.ok) {
    let errorCode: ChatErrorCode = "UNKNOWN";
    let errorDetails = `API error: ${response.status}`;

    try {
      const errorData = await response.json();
      errorCode = (errorData.code as ChatErrorCode) || "UNKNOWN";
      errorDetails = errorData.details || errorData.error || errorDetails;
    } catch {
      // Failed to parse error response
    }

    throw new ApiError(errorDetails, response.status, errorCode, errorDetails);
  }

  if (!response.body) {
    throw new ApiError("No response body", 500);
  }

  // Parse SSE stream
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        const colonIndex = line.indexOf(":");
        if (colonIndex === -1) continue;

        const eventType = line.slice(0, colonIndex);
        const eventData = line.slice(colonIndex + 1);

        try {
          if (eventType === "data") {
            const parsed = JSON.parse(eventData);

            if (parsed.type === "text-delta" && parsed.delta) {
              fullText += parsed.delta;
              onEvent({ type: "text-delta", data: parsed.delta });
            } else if (parsed.type === "reasoning-start") {
              onEvent({ type: "reasoning-start", data: parsed });
            } else if (parsed.type === "reasoning-delta" && parsed.delta) {
              onEvent({ type: "reasoning-delta", data: parsed.delta });
            } else if (parsed.type === "reasoning-end") {
              onEvent({ type: "reasoning-end", data: parsed });
            } else if (parsed.type === "tool-input-start") {
              onEvent({ type: "tool-input-start", data: parsed });
            } else if (parsed.type === "tool-input-delta") {
              onEvent({ type: "tool-input-delta", data: parsed });
            } else if (parsed.type === "tool-result") {
              onEvent({ type: "tool-result", data: parsed });
            } else if (parsed.type === "sources") {
              onEvent({ type: "sources", data: parsed.sources });
            }
          } else if (eventType === "error") {
            const parsed = JSON.parse(eventData);
            onEvent({ type: "error", data: parsed });
          }
        } catch {
          // Skip malformed lines
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      const colonIndex = buffer.indexOf(":");
      if (colonIndex !== -1) {
        const eventType = buffer.slice(0, colonIndex);
        const eventData = buffer.slice(colonIndex + 1);
        try {
          if (eventType === "data") {
            const parsed = JSON.parse(eventData);
            if (parsed.type === "text-delta" && parsed.delta) {
              fullText += parsed.delta;
              onEvent({ type: "text-delta", data: parsed.delta });
            }
          }
        } catch {
          // Ignore
        }
      }
    }

    onEvent({ type: "done", data: null });
    return fullText;
  } finally {
    reader.releaseLock();
  }
}

/**
 * Generate a title for a conversation.
 *
 * @param token - Auth token
 * @param conversationId - Conversation ID
 * @param firstMessage - First user message content
 * @returns Generated title
 */
export async function generateTitle(
  token: string,
  conversationId: string,
  firstMessage: string
): Promise<string> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/${API_VERSION}/chat/title`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      conversationId,
      firstMessage,
    }),
  });

  if (!response.ok) {
    throw new ApiError(
      `Failed to generate title: ${response.status}`,
      response.status
    );
  }

  const data = await response.json();
  return data.title || "New Chat";
}

/**
 * Fetch billing configuration.
 */
export async function getBillingConfig(): Promise<{
  subscriptionPriceId: string;
  creditPackPriceId: string;
  subscriptionCredits: number;
  creditPackAmount: number;
  creditPackPriceCents: number;
}> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/${API_VERSION}/billing/config`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new ApiError(
      `Failed to fetch billing config: ${response.status}`,
      response.status
    );
  }

  return response.json();
}
