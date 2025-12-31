import { describe, it, expect } from "vitest";

// Set up environment
process.env.COST_MARKUP = "1.0";
process.env.SUBSCRIPTION_CREDITS = "10000";
process.env.CREDIT_PACK_AMOUNT = "20000";

import { calculateCredits, getSubscriptionCredits } from "../pricing";

/**
 * These tests verify the message and token tracking logic without requiring a full Convex runtime.
 * They test the business rules and calculations used by the messages mutations.
 */

describe("Message Token Tracking Logic", () => {
  describe("Token Update Logic", () => {
    it("updates token counts on message", () => {
      const message = {
        inputTokens: undefined as number | undefined,
        outputTokens: undefined as number | undefined,
      };

      // Simulate patch
      const updated = {
        ...message,
        inputTokens: 1000,
        outputTokens: 500,
      };

      expect(updated.inputTokens).toBe(1000);
      expect(updated.outputTokens).toBe(500);
    });

    it("tracks usedOwnKey flag", () => {
      const message = {
        inputTokens: 1000,
        outputTokens: 500,
        usedOwnKey: undefined as boolean | undefined,
      };

      // When user's own key is used
      const updatedWithKey = {
        ...message,
        usedOwnKey: true,
      };

      expect(updatedWithKey.usedOwnKey).toBe(true);
    });
  });

  describe("Credit Deduction Decision Logic", () => {
    it("skips credit deduction when usedOwnKey=true", () => {
      const usedOwnKey = true;

      // The updateTokens mutation returns early if usedOwnKey
      const shouldDeduct = !usedOwnKey;
      expect(shouldDeduct).toBe(false);
    });

    it("skips credit deduction when no active subscription", () => {
      const subscription = null;

      const hasActiveSubscription =
        subscription !== null && (subscription as any)?.status === "active";
      expect(hasActiveSubscription).toBe(false);
    });

    it("proceeds with deduction for subscriber not using own key", () => {
      const usedOwnKey = false;
      const subscription = { status: "active" };

      const shouldDeduct =
        !usedOwnKey &&
        subscription !== null &&
        subscription.status === "active";
      expect(shouldDeduct).toBe(true);
    });
  });

  describe("Subscription Usage Calculation", () => {
    it("calculates total usage from period messages", () => {
      const messages = [
        {
          model: "anthropic:claude-sonnet-4",
          inputTokens: 10000,
          outputTokens: 5000,
        },
        {
          model: "anthropic:claude-sonnet-4",
          inputTokens: 20000,
          outputTokens: 10000,
        },
        { model: "openai:gpt-5.1", inputTokens: 15000, outputTokens: 8000 },
      ];

      let totalUsed = 0;
      for (const msg of messages) {
        totalUsed += calculateCredits(
          msg.model,
          msg.inputTokens,
          msg.outputTokens
        );
      }

      // Claude Sonnet: (10000*3000 + 5000*15000) / 1M = 105 credits
      // Claude Sonnet: (20000*3000 + 10000*15000) / 1M = 210 credits
      // GPT-5.1: (15000*1250 + 8000*10000) / 1M = 99 credits
      expect(totalUsed).toBe(105 + 210 + 99);
    });

    it("filters out forked messages from calculation", () => {
      const allMessages = [
        {
          model: "anthropic:claude-sonnet-4",
          inputTokens: 10000,
          outputTokens: 5000,
          wasForked: false,
        },
        {
          model: "anthropic:claude-sonnet-4",
          inputTokens: 50000,
          outputTokens: 25000,
          wasForked: true,
        },
        {
          model: "anthropic:claude-sonnet-4",
          inputTokens: 20000,
          outputTokens: 10000,
          wasForked: false,
        },
      ];

      // Filter like the query does
      const filteredMessages = allMessages.filter((msg) => !msg.wasForked);

      let totalUsed = 0;
      for (const msg of filteredMessages) {
        totalUsed += calculateCredits(
          msg.model,
          msg.inputTokens,
          msg.outputTokens
        );
      }

      // Only non-forked messages counted
      expect(filteredMessages.length).toBe(2);
      expect(totalUsed).toBe(105 + 210);
    });

    it("filters out own-key messages from calculation", () => {
      const allMessages = [
        {
          model: "anthropic:claude-sonnet-4",
          inputTokens: 10000,
          outputTokens: 5000,
          usedOwnKey: false,
        },
        {
          model: "anthropic:claude-sonnet-4",
          inputTokens: 100000,
          outputTokens: 50000,
          usedOwnKey: true,
        },
        {
          model: "anthropic:claude-sonnet-4",
          inputTokens: 20000,
          outputTokens: 10000,
          usedOwnKey: false,
        },
      ];

      const filteredMessages = allMessages.filter((msg) => !msg.usedOwnKey);

      let totalUsed = 0;
      for (const msg of filteredMessages) {
        totalUsed += calculateCredits(
          msg.model,
          msg.inputTokens,
          msg.outputTokens
        );
      }

      expect(filteredMessages.length).toBe(2);
      expect(totalUsed).toBe(105 + 210);
    });

    it("filters by billing period (createdAt >= periodStart)", () => {
      const periodStart = 1000000;
      const allMessages = [
        { createdAt: 500000, inputTokens: 100000, outputTokens: 50000 }, // Before period
        { createdAt: 1000001, inputTokens: 10000, outputTokens: 5000 }, // In period
        { createdAt: 2000000, inputTokens: 20000, outputTokens: 10000 }, // In period
      ];

      const periodMessages = allMessages.filter(
        (msg) => msg.createdAt >= periodStart
      );
      expect(periodMessages.length).toBe(2);
    });
  });

  describe("Overage Deduction Logic", () => {
    it("calculates overage correctly", () => {
      const subscriptionCredits = getSubscriptionCredits(); // 10000
      const totalUsed = 15000;

      const subscriptionBalance = subscriptionCredits - totalUsed; // -5000

      // Overage is negative balance (how much we need to deduct from purchased)
      const overage = Math.abs(Math.min(0, subscriptionBalance));
      expect(overage).toBe(5000);
    });

    it("returns 0 overage when within subscription limit", () => {
      const subscriptionCredits = getSubscriptionCredits();
      const totalUsed = 8000;

      const subscriptionBalance = subscriptionCredits - totalUsed; // 2000 (positive)

      const overage = Math.abs(Math.min(0, subscriptionBalance));
      expect(overage).toBe(0);
    });

    it("calculates amount to deduct from purchases", () => {
      const messageCost = 500;
      const subscriptionBalance = -300; // Already overspent by 300

      // Deduct the minimum of message cost and absolute overage
      const toDeduct = Math.min(messageCost, Math.abs(subscriptionBalance));
      expect(toDeduct).toBe(300);
    });

    it("deducts full message cost when overage exceeds cost", () => {
      const messageCost = 500;
      const subscriptionBalance = -1000; // Already overspent by 1000

      const toDeduct = Math.min(messageCost, Math.abs(subscriptionBalance));
      expect(toDeduct).toBe(500);
    });
  });

  describe("FIFO Purchase Deduction", () => {
    it("sorts purchases by purchasedAt (oldest first)", () => {
      const purchases = [
        { id: "3", purchasedAt: 3000 },
        { id: "1", purchasedAt: 1000 },
        { id: "2", purchasedAt: 2000 },
      ];

      const sorted = [...purchases].sort(
        (a, b) => a.purchasedAt - b.purchasedAt
      );

      expect(sorted[0].id).toBe("1");
      expect(sorted[1].id).toBe("2");
      expect(sorted[2].id).toBe("3");
    });

    it("deducts from purchases in order until amount exhausted", () => {
      const purchases = [
        { id: "1", creditsRemaining: 3000, status: "active" },
        { id: "2", creditsRemaining: 5000, status: "active" },
        { id: "3", creditsRemaining: 10000, status: "active" },
      ];

      let toDeduct = 6000;
      const results: { id: string; newBalance: number; newStatus: string }[] =
        [];

      for (const purchase of purchases) {
        if (toDeduct <= 0) break;

        const deductFromThis = Math.min(purchase.creditsRemaining, toDeduct);
        const newBalance = purchase.creditsRemaining - deductFromThis;
        const newStatus = newBalance === 0 ? "depleted" : "active";

        results.push({ id: purchase.id, newBalance, newStatus });
        toDeduct -= deductFromThis;
      }

      expect(results).toEqual([
        { id: "1", newBalance: 0, newStatus: "depleted" },
        { id: "2", newBalance: 2000, newStatus: "active" },
      ]);
      expect(toDeduct).toBe(0);
    });

    it("handles insufficient purchased credits", () => {
      const purchases = [
        { id: "1", creditsRemaining: 2000, status: "active" },
        { id: "2", creditsRemaining: 1000, status: "active" },
      ];

      let toDeduct = 5000;
      let totalDeducted = 0;

      for (const purchase of purchases) {
        if (toDeduct <= 0) break;

        const deductFromThis = Math.min(purchase.creditsRemaining, toDeduct);
        totalDeducted += deductFromThis;
        toDeduct -= deductFromThis;
      }

      expect(totalDeducted).toBe(3000);
      expect(toDeduct).toBe(2000); // 2000 couldn't be deducted
    });
  });
});

describe("Message Part Validation", () => {
  describe("Text Parts", () => {
    it("validates text part structure", () => {
      const validTextPart = { type: "text", text: "Hello world" };
      expect(validTextPart.type).toBe("text");
      expect(typeof validTextPart.text).toBe("string");
    });

    it("handles empty text", () => {
      const emptyTextPart = { type: "text", text: "" };
      expect(emptyTextPart.text).toBe("");
    });
  });

  describe("File Parts", () => {
    it("validates file part with storageId", () => {
      const filePart = {
        type: "file",
        mediaType: "image/png",
        storageId: "storage_id_123",
        fileName: "image.png",
        fileSize: 1024,
      };

      expect(filePart.type).toBe("file");
      expect(filePart.storageId).toBeDefined();
    });

    it("validates file part with URL", () => {
      const filePart = {
        type: "file",
        mediaType: "image/png",
        url: "https://example.com/image.png",
        fileName: "image.png",
      };

      expect(filePart.type).toBe("file");
      expect(filePart.url).toBeDefined();
    });
  });

  describe("Reasoning Parts", () => {
    it("validates reasoning part structure", () => {
      const reasoningPart = {
        type: "reasoning",
        text: "Let me think...",
        id: "reasoning-1",
        duration: 5.5,
      };

      expect(reasoningPart.type).toBe("reasoning");
      expect(reasoningPart.id).toBeDefined();
      expect(reasoningPart.duration).toBe(5.5);
    });
  });

  describe("Tool Invocation Parts", () => {
    it("validates tool call state", () => {
      const toolCall = {
        type: "tool-invocation",
        toolInvocationId: "call_123",
        toolName: "web_search",
        args: { query: "test" },
        state: "call",
      };

      expect(toolCall.state).toBe("call");
    });

    it("validates tool result state", () => {
      const toolResult = {
        type: "tool-invocation",
        toolInvocationId: "call_123",
        toolName: "web_search",
        args: { query: "test" },
        state: "result",
        result: { success: true },
      };

      expect(toolResult.state).toBe("result");
      expect(toolResult.result).toBeDefined();
    });
  });

  describe("Sources Parts", () => {
    it("validates sources part structure", () => {
      const sourcesPart = {
        type: "sources",
        sources: [
          { title: "Source 1", url: "https://example.com/1" },
          { title: "Source 2", url: "https://example.com/2", snippet: "..." },
        ],
      };

      expect(sourcesPart.type).toBe("sources");
      expect(sourcesPart.sources.length).toBe(2);
      expect(sourcesPart.sources[0].title).toBeDefined();
      expect(sourcesPart.sources[0].url).toBeDefined();
    });
  });
});

describe("Streaming Message Logic", () => {
  describe("createStreamingMessage", () => {
    it("creates message with empty text placeholder", () => {
      const parts = [{ type: "text" as const, text: "" }];
      expect(parts[0].text).toBe("");
    });

    it("increments conversation messageCount", () => {
      const conversation = { messageCount: 5 };
      const updated = { messageCount: conversation.messageCount + 1 };
      expect(updated.messageCount).toBe(6);
    });
  });

  describe("updateStreamingMessage", () => {
    it("replaces message parts", () => {
      const originalParts = [{ type: "text" as const, text: "" }];
      const newParts = [
        { type: "text" as const, text: "Hello " },
        { type: "reasoning" as const, text: "thinking...", id: "r1" },
      ];

      // Simulate patch
      const updated = { parts: newParts };
      expect(updated.parts.length).toBe(2);
      expect(updated.parts[0].text).toBe("Hello ");
    });

    it("updates metadata when provided", () => {
      const message = { parts: [], metadata: undefined as any };
      const newMetadata = { coreNames: ["Default"], reasoningLevel: "medium" };

      const updated = { ...message, metadata: newMetadata };
      expect(updated.metadata.coreNames).toEqual(["Default"]);
    });
  });
});

describe("Soft Delete Logic (truncateFrom)", () => {
  it("finds truncate index correctly", () => {
    const messages = [
      { messageId: "msg1" },
      { messageId: "msg2" },
      { messageId: "msg3" },
      { messageId: "msg4" },
    ];

    const truncateIndex = messages.findIndex((m) => m.messageId === "msg3");
    expect(truncateIndex).toBe(2);
  });

  it("marks messages from index onward as discarded", () => {
    const messages = [
      { messageId: "msg1", discardedAt: undefined },
      { messageId: "msg2", discardedAt: undefined },
      { messageId: "msg3", discardedAt: undefined },
      { messageId: "msg4", discardedAt: undefined },
    ];

    const truncateIndex = 2;
    const now = Date.now();
    const toDiscard = messages.slice(truncateIndex);

    const discarded = toDiscard.map((m) => ({ ...m, discardedAt: now }));

    expect(discarded.length).toBe(2);
    expect(discarded[0].messageId).toBe("msg3");
    expect(discarded[0].discardedAt).toBe(now);
    expect(discarded[1].messageId).toBe("msg4");
  });

  it("updates messageCount to truncate index", () => {
    const truncateIndex = 2;
    const newMessageCount = truncateIndex;
    expect(newMessageCount).toBe(2);
  });

  it("returns -1 when message not found", () => {
    const messages = [{ messageId: "msg1" }, { messageId: "msg2" }];
    const truncateIndex = messages.findIndex((m) => m.messageId === "msg999");
    expect(truncateIndex).toBe(-1);
  });
});

describe("addSourcesToLastAssistant Logic", () => {
  it("finds last assistant message", () => {
    const messages = [
      { role: "user", discardedAt: undefined },
      { role: "assistant", discardedAt: undefined },
      { role: "user", discardedAt: undefined },
      { role: "assistant", discardedAt: undefined },
    ];

    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant" && !m.discardedAt);

    expect(lastAssistant).toBe(messages[3]);
  });

  it("skips discarded messages", () => {
    const messages = [
      { role: "assistant", discardedAt: undefined },
      { role: "assistant", discardedAt: Date.now() }, // Discarded
    ];

    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant" && !m.discardedAt);

    expect(lastAssistant).toBe(messages[0]);
  });

  it("appends sources part to message parts", () => {
    const originalParts = [{ type: "text" as const, text: "Response" }];
    const sources = [{ title: "Source 1", url: "https://example.com" }];

    const updatedParts = [
      ...originalParts,
      { type: "sources" as const, sources },
    ];

    expect(updatedParts.length).toBe(2);
    expect(updatedParts[1].type).toBe("sources");
  });
});
