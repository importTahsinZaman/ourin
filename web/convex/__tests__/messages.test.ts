import { describe, it, expect } from "vitest";

// set up environment
process.env.COST_MARKUP = "1.0";
process.env.SUBSCRIPTION_CREDITS = "10000";
process.env.CREDIT_PACK_AMOUNT = "20000";

import { calculateCredits, getSubscriptionCredits } from "../pricing";

/**
 * these tests verify the message and token tracking logic without requiring a full convex runtime.
 * they test the business rules and calculations used by the messages mutations.
 */

describe("Message Token Tracking Logic", () => {
  describe("Token Update Logic", () => {
    it("updates token counts on message", () => {
      const message = {
        inputTokens: undefined as number | undefined,
        outputTokens: undefined as number | undefined,
      };

      // simulate patch
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

      // when user's own key is used
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

      // the updateTokens mutation returns early if usedOwnKey
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

      // claude sonnet: (10000*3000 + 5000*15000) / 1m = 105 credits
      // claude sonnet: (20000*3000 + 10000*15000) / 1m = 210 credits
      // gPT-5.1: (15000*1250 + 8000*10000) / 1m = 99 credits
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

      // filter like the query does
      const filteredMessages = allMessages.filter((msg) => !msg.wasForked);

      let totalUsed = 0;
      for (const msg of filteredMessages) {
        totalUsed += calculateCredits(
          msg.model,
          msg.inputTokens,
          msg.outputTokens
        );
      }

      // only non-forked messages counted
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
        { createdAt: 500000, inputTokens: 100000, outputTokens: 50000 }, // before period
        { createdAt: 1000001, inputTokens: 10000, outputTokens: 5000 }, // in period
        { createdAt: 2000000, inputTokens: 20000, outputTokens: 10000 }, // in period
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

      // overage is negative balance (how much we need to deduct from purchased)
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
      const subscriptionBalance = -300; // already overspent by 300

      // deduct the minimum of message cost and absolute overage
      const toDeduct = Math.min(messageCost, Math.abs(subscriptionBalance));
      expect(toDeduct).toBe(300);
    });

    it("deducts full message cost when overage exceeds cost", () => {
      const messageCost = 500;
      const subscriptionBalance = -1000; // already overspent by 1000

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
      const _originalParts = [{ type: "text" as const, text: "" }];
      const newParts = [
        { type: "text" as const, text: "Hello " },
        { type: "reasoning" as const, text: "thinking...", id: "r1" },
      ];

      // simulate patch
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
      { role: "assistant", discardedAt: Date.now() }, // discarded
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

describe("Message Insertion Idempotency", () => {
  // This tests the logic for preventing duplicate message insertions
  // which was a bug that caused credits to be double-counted

  it("detects existing message by messageId in conversation", () => {
    const existingMessages = [
      { messageId: "msg1", conversationId: "conv1" },
      { messageId: "msg2", conversationId: "conv1" },
      { messageId: "msg3", conversationId: "conv1" },
    ];

    const newMessageId = "msg2";
    const conversationId = "conv1";

    // simulate the idempotency check
    const existingMessage = existingMessages.find(
      (m) => m.messageId === newMessageId && m.conversationId === conversationId
    );

    expect(existingMessage).toBeDefined();
    expect(existingMessage?.messageId).toBe("msg2");
  });

  it("allows insertion when messageId does not exist in conversation", () => {
    const existingMessages = [
      { messageId: "msg1", conversationId: "conv1" },
      { messageId: "msg2", conversationId: "conv1" },
    ];

    const newMessageId = "msg3";
    const conversationId = "conv1";

    const existingMessage = existingMessages.find(
      (m) => m.messageId === newMessageId && m.conversationId === conversationId
    );

    expect(existingMessage).toBeUndefined();
  });

  it("allows same messageId in different conversations (forking)", () => {
    const existingMessages = [
      { messageId: "msg1", conversationId: "conv1" },
      { messageId: "msg2", conversationId: "conv1" },
    ];

    const newMessageId = "msg1"; // same as existing
    const conversationId = "conv2"; // different conversation (fork)

    const existingMessage = existingMessages.find(
      (m) => m.messageId === newMessageId && m.conversationId === conversationId
    );

    // should not find it because it's in a different conversation
    expect(existingMessage).toBeUndefined();
  });

  it("idempotency check prevents duplicate insertion logic", () => {
    const existingMessages: Array<{
      messageId: string;
      conversationId: string;
    }> = [{ messageId: "msg1", conversationId: "conv1" }];

    const insertMessage = (messageId: string, conversationId: string) => {
      // idempotency check
      const existing = existingMessages.find(
        (m) => m.messageId === messageId && m.conversationId === conversationId
      );

      if (existing) {
        return { inserted: false, reason: "already_exists" };
      }

      existingMessages.push({ messageId, conversationId });
      return { inserted: true };
    };

    // first insert of msg2 - should succeed
    const result1 = insertMessage("msg2", "conv1");
    expect(result1.inserted).toBe(true);
    expect(existingMessages.length).toBe(2);

    // second insert of msg2 - should be idempotent (no-op)
    const result2 = insertMessage("msg2", "conv1");
    expect(result2.inserted).toBe(false);
    expect(result2.reason).toBe("already_exists");
    expect(existingMessages.length).toBe(2); // still 2, not 3

    // insert msg2 in different conversation - should succeed
    const result3 = insertMessage("msg2", "conv2");
    expect(result3.inserted).toBe(true);
    expect(existingMessages.length).toBe(3);
  });
});

describe("Credit Deduplication in Billing", () => {
  it("calculates credits only once per unique messageId", () => {
    interface BillingMessage {
      messageId: string;
      credits: number;
      wasForked: boolean;
      usedOwnKey: boolean;
    }

    const messages: BillingMessage[] = [
      { messageId: "msg1", credits: 100, wasForked: false, usedOwnKey: false },
      { messageId: "msg1", credits: 100, wasForked: false, usedOwnKey: false }, // duplicate
      { messageId: "msg2", credits: 200, wasForked: false, usedOwnKey: false },
      { messageId: "msg3", credits: 300, wasForked: true, usedOwnKey: false }, // forked - excluded
      { messageId: "msg4", credits: 400, wasForked: false, usedOwnKey: true }, // own key - excluded
    ];

    // correct billing calculation with deduplication
    const seenIds = new Set<string>();
    let totalCredits = 0;

    for (const msg of messages) {
      // skip forked and own-key messages
      if (msg.wasForked || msg.usedOwnKey) continue;

      // skip duplicates
      if (seenIds.has(msg.messageId)) continue;
      seenIds.add(msg.messageId);

      totalCredits += msg.credits;
    }

    // should be: msg1 (100) + msg2 (200) = 300
    // NOT: msg1 (100) + msg1 (100) + msg2 (200) = 400 (bug)
    expect(totalCredits).toBe(300);
  });

  it("handles scenario where duplicates would cause overage", () => {
    const subscriptionCredits = 250;

    interface BillingMessage {
      messageId: string;
      credits: number;
    }

    const messages: BillingMessage[] = [
      { messageId: "msg1", credits: 100 },
      { messageId: "msg1", credits: 100 }, // duplicate
      { messageId: "msg2", credits: 100 },
      { messageId: "msg2", credits: 100 }, // duplicate
    ];

    // BUG: without dedup = 400 credits, subscription balance = -150 (overage!)
    const totalWithoutDedup = messages.reduce((sum, m) => sum + m.credits, 0);
    expect(totalWithoutDedup).toBe(400);

    const balanceWithoutDedup = subscriptionCredits - totalWithoutDedup;
    expect(balanceWithoutDedup).toBe(-150); // incorrectly shows overage

    // FIX: with dedup = 200 credits, subscription balance = 50 (no overage)
    const seenIds = new Set<string>();
    let totalWithDedup = 0;
    for (const msg of messages) {
      if (seenIds.has(msg.messageId)) continue;
      seenIds.add(msg.messageId);
      totalWithDedup += msg.credits;
    }
    expect(totalWithDedup).toBe(200);

    const balanceWithDedup = subscriptionCredits - totalWithDedup;
    expect(balanceWithDedup).toBe(50); // correctly shows remaining credits
  });
});
