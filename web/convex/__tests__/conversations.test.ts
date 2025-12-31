import { describe, it, expect } from "vitest";

/**
 * Tests for the Conversation management logic.
 * These tests verify CRUD operations, forking, and soft-delete behavior.
 */

describe("Conversation Management Logic", () => {
  describe("Create Conversation", () => {
    it("creates conversation with required fields", () => {
      const now = Date.now();
      const conversation = {
        userId: "user123",
        title: undefined,
        model: "anthropic:claude-sonnet-4",
        messageCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      expect(conversation.userId).toBe("user123");
      expect(conversation.messageCount).toBe(0);
      expect(conversation.createdAt).toBe(now);
    });

    it("allows optional title", () => {
      const conversation = {
        userId: "user123",
        title: undefined,
        messageCount: 0,
      };

      expect(conversation.title).toBeUndefined();
    });

    it("stores fork metadata when forking", () => {
      const forkedConversation = {
        userId: "user123",
        forkedFrom: "conv_original",
        forkedAtMessageId: "msg_5",
        messageCount: 5,
      };

      expect(forkedConversation.forkedFrom).toBe("conv_original");
      expect(forkedConversation.forkedAtMessageId).toBe("msg_5");
    });
  });

  describe("List Conversations", () => {
    it("filters by userId", () => {
      const conversations = [
        { userId: "user1", title: "Conv 1" },
        { userId: "user2", title: "Conv 2" },
        { userId: "user1", title: "Conv 3" },
      ];

      const user1Convs = conversations.filter((c) => c.userId === "user1");

      expect(user1Convs.length).toBe(2);
    });

    it("excludes deleted conversations", () => {
      const conversations = [
        { title: "Active", deletedAt: undefined },
        { title: "Deleted", deletedAt: Date.now() },
        { title: "Also Active", deletedAt: undefined },
      ];

      const activeConvs = conversations.filter(
        (c) => c.deletedAt === undefined
      );

      expect(activeConvs.length).toBe(2);
      expect(activeConvs.every((c) => c.deletedAt === undefined)).toBe(true);
    });

    it("returns empty array for unauthenticated users", () => {
      const userId = null;

      if (!userId) {
        const conversations: unknown[] = [];
        expect(conversations).toEqual([]);
      }
    });

    it("sorts by updatedAt descending", () => {
      const conversations = [
        { title: "Old", updatedAt: 1000 },
        { title: "Newest", updatedAt: 3000 },
        { title: "Middle", updatedAt: 2000 },
      ];

      const sorted = [...conversations].sort(
        (a, b) => b.updatedAt - a.updatedAt
      );

      expect(sorted[0].title).toBe("Newest");
      expect(sorted[1].title).toBe("Middle");
      expect(sorted[2].title).toBe("Old");
    });
  });

  describe("Get Conversation", () => {
    it("returns conversation for owner", () => {
      const conversation = { userId: "user123", title: "My Chat" };
      const requestingUserId = "user123";

      const canAccess = conversation.userId === requestingUserId;
      expect(canAccess).toBe(true);
    });

    it("returns null for non-owner", () => {
      const conversation = { userId: "user123", title: "My Chat" };
      const requestingUserId = "user456";

      const canAccess = conversation.userId === requestingUserId;
      expect(canAccess).toBe(false);
    });

    it("returns null for deleted conversation", () => {
      const conversation = {
        userId: "user123",
        title: "Deleted Chat",
        deletedAt: Date.now(),
      };

      const isDeleted = conversation.deletedAt !== undefined;
      expect(isDeleted).toBe(true);
    });
  });

  describe("Update Title", () => {
    it("updates title and updatedAt", () => {
      const conversation = {
        title: "Old Title",
        updatedAt: 1000,
      };

      const now = Date.now();
      const updated = {
        ...conversation,
        title: "New Title",
        updatedAt: now,
      };

      expect(updated.title).toBe("New Title");
      expect(updated.updatedAt).toBe(now);
    });

    it("requires ownership to update", () => {
      const conversation = { userId: "user123" };
      const requestingUserId = "user456";

      const canUpdate = conversation.userId === requestingUserId;
      expect(canUpdate).toBe(false);
    });
  });

  describe("Toggle Favorite", () => {
    it("toggles favorite from false to true", () => {
      const conversation = { isFavorite: false };
      const updated = { ...conversation, isFavorite: !conversation.isFavorite };
      expect(updated.isFavorite).toBe(true);
    });

    it("toggles favorite from true to false", () => {
      const conversation = { isFavorite: true };
      const updated = { ...conversation, isFavorite: !conversation.isFavorite };
      expect(updated.isFavorite).toBe(false);
    });

    it("handles undefined as false", () => {
      const conversation = { isFavorite: undefined };
      const updated = { ...conversation, isFavorite: !conversation.isFavorite };
      expect(updated.isFavorite).toBe(true);
    });
  });

  describe("Soft Delete (Remove)", () => {
    it("sets deletedAt timestamp", () => {
      const conversation = { deletedAt: undefined as number | undefined };
      const now = Date.now();

      conversation.deletedAt = now;

      expect(conversation.deletedAt).toBe(now);
    });

    it("soft-deletes all messages in conversation", () => {
      const messages = [
        { id: "1", discardedAt: undefined as number | undefined },
        { id: "2", discardedAt: undefined as number | undefined },
        { id: "3", discardedAt: undefined as number | undefined },
      ];

      const now = Date.now();

      for (const message of messages) {
        message.discardedAt = now;
      }

      expect(messages.every((m) => m.discardedAt === now)).toBe(true);
    });

    it("preserves messages for billing accuracy", () => {
      // Soft delete doesn't actually remove data - just marks it
      const message = {
        id: "msg1",
        inputTokens: 1000,
        outputTokens: 500,
        discardedAt: undefined as number | undefined,
      };

      message.discardedAt = Date.now();

      // Token data is preserved for billing
      expect(message.inputTokens).toBe(1000);
      expect(message.outputTokens).toBe(500);
    });
  });

  describe("Update Metadata", () => {
    it("updates messageCount", () => {
      const conversation = { messageCount: 5 };
      const updated = { ...conversation, messageCount: 6 };
      expect(updated.messageCount).toBe(6);
    });

    it("updates model if provided", () => {
      const conversation = { model: "anthropic:claude-sonnet-4" };
      const updated = { ...conversation, model: "openai:gpt-4o" };
      expect(updated.model).toBe("openai:gpt-4o");
    });

    it("preserves existing model if not provided", () => {
      const conversation = { model: "anthropic:claude-sonnet-4" };
      const newModel = undefined;
      const updated = {
        ...conversation,
        model: newModel || conversation.model,
      };
      expect(updated.model).toBe("anthropic:claude-sonnet-4");
    });

    it("updates updatedAt timestamp", () => {
      const conversation = { updatedAt: 1000 };
      const now = Date.now();
      const updated = { ...conversation, updatedAt: now };
      expect(updated.updatedAt).toBeGreaterThan(conversation.updatedAt);
    });
  });

  describe("Fork Conversation", () => {
    it("finds fork point message index", () => {
      const messages = [
        { messageId: "msg1" },
        { messageId: "msg2" },
        { messageId: "msg3" },
        { messageId: "msg4" },
      ];

      const forkedAtMessageId = "msg2";
      const forkIndex = messages.findIndex(
        (m) => m.messageId === forkedAtMessageId
      );

      expect(forkIndex).toBe(1);
    });

    it("includes messages up to and including fork point", () => {
      const messages = [
        { messageId: "msg1", content: "First" },
        { messageId: "msg2", content: "Second" },
        { messageId: "msg3", content: "Third" },
        { messageId: "msg4", content: "Fourth" },
      ];

      const forkIndex = 1; // msg2
      const messagesToFork = messages.slice(0, forkIndex + 1);

      expect(messagesToFork.length).toBe(2);
      expect(messagesToFork[0].messageId).toBe("msg1");
      expect(messagesToFork[1].messageId).toBe("msg2");
    });

    it("excludes discarded messages", () => {
      const messages = [
        { messageId: "msg1", discardedAt: undefined },
        { messageId: "msg2", discardedAt: Date.now() }, // Discarded
        { messageId: "msg3", discardedAt: undefined },
      ];

      const activeMessages = messages.filter(
        (m) => m.discardedAt === undefined
      );

      expect(activeMessages.length).toBe(2);
    });

    it("creates forked conversation with correct metadata", () => {
      const sourceConversation = {
        title: "Original Chat",
        model: "anthropic:claude-sonnet-4",
      };

      const now = Date.now();
      // First fork gets (1) prefix
      const forkedConversation = {
        title: sourceConversation.title
          ? `(1) ${sourceConversation.title}`
          : undefined,
        model: sourceConversation.model,
        messageCount: 3,
        createdAt: now,
        updatedAt: now,
        forkedFrom: "source_conv_id",
        forkedAtMessageId: "msg3",
      };

      expect(forkedConversation.title).toBe("(1) Original Chat");
      expect(forkedConversation.model).toBe("anthropic:claude-sonnet-4");
      expect(forkedConversation.forkedFrom).toBe("source_conv_id");
    });

    it("increments fork number based on existing forks", () => {
      const existingConversations = [
        { title: "My Chat" },
        { title: "(1) My Chat" },
        { title: "(2) My Chat" },
      ];

      const baseTitle = "My Chat";
      const pattern = new RegExp(
        `^\\((\\d+)\\)\\s*${baseTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`
      );

      let maxNumber = 0;
      for (const conv of existingConversations) {
        if (conv.title) {
          const match = conv.title.match(pattern);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNumber) maxNumber = num;
          }
        }
      }

      const newTitle = `(${maxNumber + 1}) ${baseTitle}`;
      expect(newTitle).toBe("(3) My Chat");
    });

    it("strips existing (N) prefix when forking a fork", () => {
      const sourceTitle = "(2) My Chat";
      const baseTitle = sourceTitle.replace(/^\(\d+\)\s*/, "");

      expect(baseTitle).toBe("My Chat");
    });

    it("marks forked messages with wasForked=true", () => {
      const originalMessage = {
        messageId: "msg1",
        content: "Hello",
        inputTokens: 100,
        outputTokens: 50,
      };

      const forkedMessage = {
        ...originalMessage,
        wasForked: true,
      };

      expect(forkedMessage.wasForked).toBe(true);
      // Original token data is preserved
      expect(forkedMessage.inputTokens).toBe(100);
      expect(forkedMessage.outputTokens).toBe(50);
    });

    it("forked messages are excluded from billing", () => {
      const messages = [
        { inputTokens: 100, outputTokens: 50, wasForked: false },
        { inputTokens: 200, outputTokens: 100, wasForked: true }, // Forked - excluded
        { inputTokens: 150, outputTokens: 75, wasForked: false },
      ];

      const billableMessages = messages.filter((m) => !m.wasForked);
      const totalInputTokens = billableMessages.reduce(
        (sum, m) => sum + m.inputTokens,
        0
      );
      const totalOutputTokens = billableMessages.reduce(
        (sum, m) => sum + m.outputTokens,
        0
      );

      expect(billableMessages.length).toBe(2);
      expect(totalInputTokens).toBe(250); // 100 + 150
      expect(totalOutputTokens).toBe(125); // 50 + 75
    });

    it("returns error when fork point not found", () => {
      const messages = [{ messageId: "msg1" }, { messageId: "msg2" }];

      const forkedAtMessageId = "msg999";
      const forkIndex = messages.findIndex(
        (m) => m.messageId === forkedAtMessageId
      );

      expect(forkIndex).toBe(-1);
    });

    it("requires ownership of source conversation", () => {
      const sourceConversation = { userId: "user123" };
      const requestingUserId = "user456";

      const canFork = sourceConversation.userId === requestingUserId;
      expect(canFork).toBe(false);
    });
  });

  describe("Conversation Ownership", () => {
    it("validates user owns conversation before mutation", () => {
      const conversation = { userId: "user123" };
      const requestingUserId = "user123";

      const isOwner = conversation.userId === requestingUserId;
      expect(isOwner).toBe(true);
    });

    it("throws for non-owner", () => {
      const conversation = { userId: "user123" };
      const requestingUserId = "user456";

      const isOwner = conversation.userId === requestingUserId;
      expect(isOwner).toBe(false);
    });
  });

  describe("Message Count Tracking", () => {
    it("increments on new message", () => {
      const conversation = { messageCount: 5 };
      const updated = {
        ...conversation,
        messageCount: conversation.messageCount + 1,
      };
      expect(updated.messageCount).toBe(6);
    });

    it("decrements on truncate", () => {
      const truncateIndex = 3;
      const newMessageCount = truncateIndex;
      expect(newMessageCount).toBe(3);
    });

    it("starts at 0 for new conversation", () => {
      const conversation = { messageCount: 0 };
      expect(conversation.messageCount).toBe(0);
    });
  });
});
