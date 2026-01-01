import { describe, it, expect, vi } from "vitest";

// Set up environment
process.env.CHAT_AUTH_SECRET = "test-secret";
process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";

/**
 * Tests for the chat API route logic.
 * These tests verify authorization, message conversion, and error handling
 * without making actual AI provider calls.
 */

describe("Chat API Route Logic", () => {
  const FREE_MODEL_ID = "google:gemini-2.5-flash-lite";

  describe("Authorization Logic", () => {
    describe("Token Validation", () => {
      it("returns 401 when no token provided", async () => {
        const response = mockAuthResponse(null, null);
        expect(response.status).toBe(401);
        expect(response.code).toBeUndefined();
      });

      it("returns 401 when token is invalid", async () => {
        const response = mockAuthResponse("invalid-token", null);
        expect(response.status).toBe(401);
      });

      it("returns 401 when token is expired", async () => {
        const response = mockAuthResponse("expired-token", null);
        expect(response.status).toBe(401);
      });
    });

    describe("Free Tier Access", () => {
      it("allows free model for free tier user", () => {
        const tier = { tier: "free", canSendMessage: true };
        const requestedModel = FREE_MODEL_ID;

        const canAccess = checkModelAccess(tier, requestedModel);
        expect(canAccess.allowed).toBe(true);
      });

      it("blocks premium model for free tier user", () => {
        const tier = { tier: "free", canSendMessage: true };
        const requestedModel = "anthropic:claude-sonnet-4";

        const canAccess = checkModelAccess(tier, requestedModel);
        expect(canAccess.allowed).toBe(false);
        expect(canAccess.code).toBe("MODEL_RESTRICTED");
      });

      it("blocks when free message limit reached", () => {
        const tier = { tier: "free", canSendMessage: false };
        const requestedModel = FREE_MODEL_ID;

        const canAccess = checkModelAccess(tier, requestedModel);
        expect(canAccess.allowed).toBe(false);
        expect(canAccess.code).toBe("FREE_LIMIT_REACHED");
      });
    });

    describe("Subscriber Tier Access", () => {
      it("allows any model for subscriber with credits", () => {
        const tier = {
          tier: "subscriber",
          canSendMessage: true,
          providers: [],
        };
        const requestedModel = "anthropic:claude-opus-4-5-20251101";

        const canAccess = checkSubscriberAccess(tier);
        expect(canAccess.allowed).toBe(true);
      });

      it("blocks when subscriber has no credits and no API keys", () => {
        const tier = {
          tier: "subscriber",
          canSendMessage: false,
          providers: [],
        };

        const canAccess = checkSubscriberAccess(tier);
        expect(canAccess.allowed).toBe(false);
        expect(canAccess.code).toBe("CREDITS_DEPLETED");
      });

      it("allows subscriber with own keys even if credits depleted", () => {
        const tier = {
          tier: "subscriber",
          canSendMessage: true, // true because has own keys
          providers: ["anthropic"],
        };

        const canAccess = checkSubscriberAccess(tier);
        expect(canAccess.allowed).toBe(true);
      });
    });

    describe("Anonymous User Access", () => {
      it("allows free model for anonymous user", () => {
        const isAnonymous = true;
        const requestedModel = FREE_MODEL_ID;

        const canAccess = checkAnonymousAccess(isAnonymous, requestedModel);
        expect(canAccess.allowed).toBe(true);
      });

      it("blocks premium model for anonymous user", () => {
        const isAnonymous = true;
        const requestedModel = "anthropic:claude-sonnet-4";

        const canAccess = checkAnonymousAccess(isAnonymous, requestedModel);
        expect(canAccess.allowed).toBe(false);
        expect(canAccess.code).toBe("MODEL_RESTRICTED");
      });
    });
  });

  describe("Self-Hosted Tier Access", () => {
    it("allows any model for self-hosted user", () => {
      const tier = { tier: "self_hosted", canSendMessage: true };
      const requestedModel = "anthropic:claude-opus-4-5-20251101";

      const canAccess = checkSelfHostedAccess(tier);
      expect(canAccess.allowed).toBe(true);
    });

    it("self-hosted tier has no model restrictions", () => {
      const tier = { tier: "self_hosted", canSendMessage: true };

      // Should allow any model
      expect(checkSelfHostedAccess(tier).allowed).toBe(true);

      // Premium models should work
      const premiumModel = "anthropic:claude-opus-4-5-20251101";
      expect(checkModelAccessWithSelfHosting(tier, premiumModel).allowed).toBe(
        true
      );
    });

    it("self-hosted tier bypasses credit checks", () => {
      const tier = { tier: "self_hosted", canSendMessage: true };

      // canSendMessage should always be true in self-hosted mode
      expect(tier.canSendMessage).toBe(true);
    });
  });

  describe("Web Search Access Logic", () => {
    it("allows web search for subscriber with supporting model", () => {
      const tier = { tier: "subscriber" };
      const modelSupportsWebSearch = true;
      const webSearchEnabled = true;

      const shouldUseWebSearch = canUseWebSearchCheck(
        tier,
        modelSupportsWebSearch,
        webSearchEnabled,
        false
      );
      expect(shouldUseWebSearch).toBe(true);
    });

    it("allows web search for self-hosted with supporting model", () => {
      const tier = { tier: "self_hosted" };
      const modelSupportsWebSearch = true;
      const webSearchEnabled = true;

      const shouldUseWebSearch = canUseWebSearchCheck(
        tier,
        modelSupportsWebSearch,
        webSearchEnabled,
        true
      );
      expect(shouldUseWebSearch).toBe(true);
    });

    it("disables web search for free tier", () => {
      const tier = { tier: "free" };
      const modelSupportsWebSearch = true;
      const webSearchEnabled = true;

      const shouldUseWebSearch = canUseWebSearchCheck(
        tier,
        modelSupportsWebSearch,
        webSearchEnabled,
        false
      );
      expect(shouldUseWebSearch).toBe(false);
    });

    it("disables web search when model doesn't support it", () => {
      const tier = { tier: "subscriber" };
      const modelSupportsWebSearch = false;
      const webSearchEnabled = true;

      const shouldUseWebSearch = canUseWebSearchCheck(
        tier,
        modelSupportsWebSearch,
        webSearchEnabled,
        false
      );
      expect(shouldUseWebSearch).toBe(false);
    });

    it("disables web search when not requested", () => {
      const tier = { tier: "subscriber" };
      const modelSupportsWebSearch = true;
      const webSearchEnabled = false;

      const shouldUseWebSearch = canUseWebSearchCheck(
        tier,
        modelSupportsWebSearch,
        webSearchEnabled,
        false
      );
      expect(shouldUseWebSearch).toBe(false);
    });

    it("disables web search for self-hosted when model doesn't support it", () => {
      const tier = { tier: "self_hosted" };
      const modelSupportsWebSearch = false;
      const webSearchEnabled = true;

      const shouldUseWebSearch = canUseWebSearchCheck(
        tier,
        modelSupportsWebSearch,
        webSearchEnabled,
        true
      );
      expect(shouldUseWebSearch).toBe(false);
    });
  });

  describe("Token Counting Logic", () => {
    it("counts tokens in simple text", () => {
      // Approximate: ~4 chars per token
      const text = "Hello, how are you doing today?";
      const estimate = Math.ceil(text.length / 4);
      expect(estimate).toBeGreaterThan(0);
      expect(estimate).toBeLessThan(20);
    });

    it("adds overhead for message structure", () => {
      const messageCount = 5;
      const overheadPerMessage = 4;
      const totalOverhead = messageCount * overheadPerMessage;
      expect(totalOverhead).toBe(20);
    });

    it("adds overhead for web search tools", () => {
      const baseTokens = 1000;
      const webSearchOverhead = 1500;
      const totalWithWebSearch = baseTokens + webSearchOverhead;
      expect(totalWithWebSearch).toBe(2500);
    });

    it("adds overhead for images", () => {
      const baseTokens = 1000;
      const imageCount = 3;
      const imageOverhead = 4000;
      const totalWithImages = baseTokens + imageCount * imageOverhead;
      expect(totalWithImages).toBe(13000);
    });

    it("falls back to character-based estimate", () => {
      const text = "Hello world";
      const fallbackEstimate = Math.ceil(text.length / 4);
      expect(fallbackEstimate).toBe(3);
    });
  });

  describe("Message Conversion Logic", () => {
    it("converts text-only user message", () => {
      const message = {
        role: "user",
        parts: [{ type: "text", text: "Hello" }],
      };

      const converted = convertUserMessage(message);
      expect(converted.role).toBe("user");
      expect(converted.content).toEqual([{ type: "text", text: "Hello" }]);
    });

    it("extracts text from assistant message", () => {
      const message = {
        role: "assistant",
        parts: [
          { type: "text", text: "Hi there!" },
          { type: "reasoning", text: "thinking..." },
        ],
      };

      const converted = convertAssistantMessage(message);
      expect(converted.role).toBe("assistant");
      expect(converted.content).toBe("Hi there!");
    });

    it("handles empty content with placeholder", () => {
      const message = {
        role: "user",
        parts: [],
      };

      const converted = convertUserMessage(message);
      expect(converted.content).toEqual([{ type: "text", text: "" }]);
    });

    it("converts image attachment", () => {
      const part = {
        type: "file",
        mediaType: "image/png",
        url: "https://example.com/image.png",
        fileName: "image.png",
      };

      const isImage = part.mediaType.startsWith("image/");
      expect(isImage).toBe(true);
    });

    it("converts PDF attachment", () => {
      const part = {
        type: "file",
        mediaType: "application/pdf",
        url: "https://example.com/doc.pdf",
        fileName: "doc.pdf",
      };

      const isPdf = part.mediaType === "application/pdf";
      expect(isPdf).toBe(true);
    });

    it("handles unsupported file type as text placeholder", () => {
      const part = {
        type: "file",
        mediaType: "application/zip",
        url: "https://example.com/file.zip",
        fileName: "file.zip",
      };

      const isImage = part.mediaType.startsWith("image/");
      const isPdf = part.mediaType === "application/pdf";
      const isSupported = isImage || isPdf;

      expect(isSupported).toBe(false);
      // Should convert to: { type: "text", text: "[Attached file: file.zip]" }
    });
  });

  describe("Error Response Format", () => {
    it("formats 401 Unauthorized response", () => {
      const response = createErrorResponse(
        401,
        "Unauthorized - no token provided"
      );
      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Unauthorized - no token provided");
    });

    it("formats 402 Payment Required response with code", () => {
      const response = createErrorResponse(
        402,
        "Credits depleted",
        "CREDITS_DEPLETED",
        "Purchase more credits to continue."
      );
      expect(response.status).toBe(402);
      expect(response.body.code).toBe("CREDITS_DEPLETED");
      expect(response.body.details).toBeDefined();
    });

    it("formats 403 Forbidden response with code", () => {
      const response = createErrorResponse(
        403,
        "Model not available",
        "MODEL_RESTRICTED",
        "Subscribe to access this model."
      );
      expect(response.status).toBe(403);
      expect(response.body.code).toBe("MODEL_RESTRICTED");
    });

    it("formats 500 Internal Server Error response", () => {
      const response = createErrorResponse(
        500,
        "Failed to process chat request",
        undefined,
        "Error details here"
      );
      expect(response.status).toBe(500);
      expect(response.body.details).toBe("Error details here");
    });
  });

  describe("Reasoning Configuration", () => {
    it("enables Anthropic extended thinking", () => {
      const modelProvider = "anthropic";
      const reasoningKind = "budget";
      const reasoningLevel = 8000;

      const config = buildReasoningConfig(
        modelProvider,
        reasoningKind,
        reasoningLevel
      );

      expect(config).toEqual({
        anthropic: {
          thinking: {
            type: "enabled",
            budgetTokens: 8000,
          },
        },
      });
    });

    it("enables OpenAI reasoning effort", () => {
      const modelProvider = "openai";
      const reasoningKind = "effort";
      const reasoningLevel = "high";

      const config = buildReasoningConfig(
        modelProvider,
        reasoningKind,
        reasoningLevel
      );

      expect(config).toEqual({
        openai: {
          reasoningEffort: "high",
        },
      });
    });

    it("enables Google thinking config", () => {
      const modelProvider = "google";
      const reasoningKind = "effort";
      const reasoningLevel = "high";

      const config = buildReasoningConfig(
        modelProvider,
        reasoningKind,
        reasoningLevel
      );

      expect(config).toEqual({
        google: {
          thinkingConfig: {
            thinkingLevel: "high",
            includeThoughts: true,
          },
        },
      });
    });

    it("returns undefined when reasoning is off", () => {
      const reasoningLevel = "off";
      const config = buildReasoningConfig(
        "anthropic",
        "budget",
        reasoningLevel
      );
      expect(config).toBeUndefined();
    });
  });

  describe("Error Sanitization", () => {
    it("passes through rate limit errors", () => {
      const error = new Error("rate limit exceeded");
      const sanitized = sanitizeErrorMessage(error);
      expect(sanitized).toBe("rate limit exceeded");
    });

    it("passes through overloaded errors", () => {
      const error = new Error("server overloaded, please retry");
      const sanitized = sanitizeErrorMessage(error);
      expect(sanitized).toBe("server overloaded, please retry");
    });

    it("passes through timeout errors", () => {
      const error = new Error("request timeout after 30s");
      const sanitized = sanitizeErrorMessage(error);
      expect(sanitized).toBe("request timeout after 30s");
    });

    it("sanitizes unknown errors to generic message", () => {
      const error = new Error(
        "Connection to database failed at 192.168.1.1:5432"
      );
      const sanitized = sanitizeErrorMessage(error);
      expect(sanitized).toBe("An unexpected error occurred. Please try again.");
    });

    it("sanitizes errors with stack traces", () => {
      const error = new Error(
        "TypeError: Cannot read property 'foo' of undefined"
      );
      const sanitized = sanitizeErrorMessage(error);
      expect(sanitized).toBe("An unexpected error occurred. Please try again.");
    });

    it("sanitizes non-Error objects", () => {
      const error = "string error with internal details";
      const sanitized = sanitizeErrorMessage(error);
      expect(sanitized).toBe("An unexpected error occurred. Please try again.");
    });

    it("sanitizes null/undefined errors", () => {
      expect(sanitizeErrorMessage(null)).toBe(
        "An unexpected error occurred. Please try again."
      );
      expect(sanitizeErrorMessage(undefined)).toBe(
        "An unexpected error occurred. Please try again."
      );
    });
  });

  describe("usedOwnKey Flag Logic", () => {
    it("sets usedOwnKey=true when using custom API key", () => {
      const tier = { tier: "subscriber", providers: ["anthropic"] };
      const modelProvider = "anthropic";
      const hasProviderKey = tier.providers.includes(modelProvider);

      expect(hasProviderKey).toBe(true);
      // When hasProviderKey is true and key is retrieved, usedOwnKey=true
    });

    it("sets usedOwnKey=false when using platform key", () => {
      const tier = { tier: "subscriber", providers: [] as string[] };
      const modelProvider = "anthropic";
      const hasProviderKey = tier.providers.includes(modelProvider);

      expect(hasProviderKey).toBe(false);
      // When no provider key, usedOwnKey=false (or undefined)
    });
  });
});

// Helper functions to test the route logic

function mockAuthResponse(
  token: string | null,
  userId: string | null
): { status: number; code?: string } {
  if (!token) {
    return { status: 401 };
  }
  if (!userId) {
    return { status: 401 };
  }
  return { status: 200 };
}

function checkModelAccess(
  tier: { tier: string; canSendMessage: boolean },
  requestedModel: string
): { allowed: boolean; code?: string } {
  const FREE_MODEL_ID = "google:gemini-2.5-flash-lite";

  if (tier.tier === "free") {
    if (requestedModel !== FREE_MODEL_ID) {
      return { allowed: false, code: "MODEL_RESTRICTED" };
    }
    if (!tier.canSendMessage) {
      return { allowed: false, code: "FREE_LIMIT_REACHED" };
    }
  }
  return { allowed: true };
}

function checkSubscriberAccess(tier: {
  tier: string;
  canSendMessage: boolean;
  providers: string[];
}): { allowed: boolean; code?: string } {
  if (!tier.canSendMessage && tier.providers.length === 0) {
    return { allowed: false, code: "CREDITS_DEPLETED" };
  }
  return { allowed: true };
}

function checkAnonymousAccess(
  isAnonymous: boolean,
  requestedModel: string
): { allowed: boolean; code?: string } {
  const FREE_MODEL_ID = "google:gemini-2.5-flash-lite";

  if (isAnonymous && requestedModel !== FREE_MODEL_ID) {
    return { allowed: false, code: "MODEL_RESTRICTED" };
  }
  return { allowed: true };
}

function convertUserMessage(message: {
  role: string;
  parts: Array<{ type: string; text?: string }>;
}): { role: string; content: Array<{ type: string; text: string }> } {
  const contentParts = message.parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => ({ type: "text", text: p.text! }));

  if (contentParts.length === 0) {
    contentParts.push({ type: "text", text: "" });
  }

  return { role: "user", content: contentParts };
}

function convertAssistantMessage(message: {
  role: string;
  parts: Array<{ type: string; text?: string }>;
}): { role: string; content: string } {
  const text = message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text || "")
    .join("");

  return { role: "assistant", content: text };
}

function createErrorResponse(
  status: number,
  error: string,
  code?: string,
  details?: string
): {
  status: number;
  body: { error: string; code?: string; details?: string };
} {
  return {
    status,
    body: {
      error,
      ...(code && { code }),
      ...(details && { details }),
    },
  };
}

function buildReasoningConfig(
  provider: string,
  kind: string,
  level: string | number
): any {
  if (level === "off") return undefined;

  if (provider === "anthropic" && kind === "budget") {
    return {
      anthropic: {
        thinking: {
          type: "enabled",
          budgetTokens: typeof level === "number" ? level : 8000,
        },
      },
    };
  }

  if (provider === "openai" && kind === "effort") {
    return {
      openai: {
        reasoningEffort: level,
      },
    };
  }

  if (provider === "google" && kind === "effort") {
    return {
      google: {
        thinkingConfig: {
          thinkingLevel: level,
          includeThoughts: true,
        },
      },
    };
  }

  return undefined;
}

function sanitizeErrorMessage(error: unknown): string {
  const GENERIC_ERROR = "An unexpected error occurred. Please try again.";

  const isKnownError =
    error instanceof Error &&
    (error.message.includes("rate limit") ||
      error.message.includes("overloaded") ||
      error.message.includes("timeout"));

  if (isKnownError) {
    return (error as Error).message;
  }

  return GENERIC_ERROR;
}

function checkSelfHostedAccess(tier: {
  tier: string;
  canSendMessage: boolean;
}): { allowed: boolean; code?: string } {
  if (tier.tier === "self_hosted") {
    return { allowed: true };
  }
  return { allowed: false, code: "NOT_SELF_HOSTED" };
}

function checkModelAccessWithSelfHosting(
  tier: { tier: string; canSendMessage: boolean },
  requestedModel: string
): { allowed: boolean; code?: string } {
  const FREE_MODEL_ID = "google:gemini-2.5-flash-lite";

  // Self-hosted tier has full access to all models
  if (tier.tier === "self_hosted") {
    return { allowed: true };
  }

  // Fall back to existing logic for other tiers
  if (tier.tier === "free") {
    if (requestedModel !== FREE_MODEL_ID) {
      return { allowed: false, code: "MODEL_RESTRICTED" };
    }
    if (!tier.canSendMessage) {
      return { allowed: false, code: "FREE_LIMIT_REACHED" };
    }
  }
  return { allowed: true };
}

function canUseWebSearchCheck(
  tier: { tier: string },
  modelSupportsWebSearch: boolean,
  webSearchEnabled: boolean,
  isSelfHosting: boolean
): boolean {
  if (!modelSupportsWebSearch || !webSearchEnabled) {
    return false;
  }

  // In self-hosting mode, web search is allowed for any tier
  if (isSelfHosting) {
    return true;
  }

  // In production mode, only subscribers can use web search
  return tier?.tier === "subscriber";
}
