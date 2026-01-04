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

  // React Native doesn't fully support ReadableStream
  // Fall back to reading the full response as text and parsing SSE format
  const text = await response.text();
  let fullText = "";

  // Parse SSE format from full response
  const lines = text.split("\n");

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

  onEvent({ type: "done", data: null });
  return fullText;
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
      userMessage: firstMessage,
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
 * Billing configuration response type
 */
export interface BillingConfig {
  isSelfHosting: boolean;
  subscriptionCredits: number;
  subscriptionPriceCents: number;
  creditPackAmount: number;
  creditPackPriceCents: number;
}

/**
 * Fetch billing configuration.
 */
export async function getBillingConfig(): Promise<BillingConfig> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/billing/config`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new ApiError(
      `Failed to fetch billing config: ${response.status}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Create a Stripe checkout session for subscription.
 * Returns the checkout URL to open in browser.
 */
export async function createSubscriptionCheckout(
  token: string
): Promise<{ url: string }> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/stripe/checkout`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Platform": "mobile",
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(
      error.error || `Failed to create checkout: ${response.status}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Create a Stripe checkout session for buying credits.
 * Requires active subscription.
 * Returns the checkout URL to open in browser.
 */
export async function createCreditsCheckout(
  token: string
): Promise<{ url: string }> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/stripe/buy-credits`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Platform": "mobile",
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(
      error.error || `Failed to create checkout: ${response.status}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Create a Stripe customer portal session.
 * Returns the portal URL to open in browser.
 */
export async function createPortalSession(
  token: string
): Promise<{ url: string }> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/stripe/portal`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Platform": "mobile",
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(
      error.error || `Failed to create portal session: ${response.status}`,
      response.status
    );
  }

  return response.json();
}
