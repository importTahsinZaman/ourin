import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Create a new conversation
export const create = mutation({
  args: {
    title: v.optional(v.string()),
    model: v.optional(v.string()),
    forkedFrom: v.optional(v.id("conversations")),
    forkedAtMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = Date.now();
    const conversationId = await ctx.db.insert("conversations", {
      userId,
      title: args.title,
      model: args.model,
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
      forkedFrom: args.forkedFrom,
      forkedAtMessageId: args.forkedAtMessageId,
    });

    return conversationId;
  },
});

// Get all conversations for the current user (excludes deleted)
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .order("desc")
      .collect();

    return conversations;
  },
});

// Get a single conversation (returns null if deleted)
export const get = query({
  args: { id: v.id("conversations") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const conversation = await ctx.db.get(id);
    if (!conversation || conversation.userId !== userId) return null;
    if (conversation.deletedAt) return null; // Exclude deleted conversations

    return conversation;
  },
});

// Update conversation title
export const updateTitle = mutation({
  args: {
    id: v.id("conversations"),
    title: v.string(),
  },
  handler: async (ctx, { id, title }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const conversation = await ctx.db.get(id);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }

    await ctx.db.patch(id, {
      title,
      updatedAt: Date.now(),
    });
  },
});

// Toggle conversation favorite status
export const toggleFavorite = mutation({
  args: {
    id: v.id("conversations"),
  },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const conversation = await ctx.db.get(id);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }

    await ctx.db.patch(id, {
      isFavorite: !conversation.isFavorite,
    });

    return !conversation.isFavorite;
  },
});

// Soft-delete a conversation (preserves messages for accurate billing)
export const remove = mutation({
  args: { id: v.id("conversations") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const conversation = await ctx.db.get(id);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }

    const now = Date.now();

    // Soft-delete all messages in the conversation (mark as discarded)
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", id))
      .collect();

    for (const message of messages) {
      await ctx.db.patch(message._id, { discardedAt: now });
    }

    // Soft-delete the conversation
    await ctx.db.patch(id, { deletedAt: now });
  },
});

// Update conversation metadata (called after messages are saved)
export const updateMetadata = mutation({
  args: {
    id: v.id("conversations"),
    messageCount: v.number(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, { id, messageCount, model }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const conversation = await ctx.db.get(id);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }

    await ctx.db.patch(id, {
      messageCount,
      model: model || conversation.model,
      updatedAt: Date.now(),
    });
  },
});

// Fork a conversation at a specific message
// Queries source messages directly from DB to get complete data including tokens
export const fork = mutation({
  args: {
    sourceConversationId: v.id("conversations"),
    forkedAtMessageId: v.string(),
  },
  handler: async (ctx, { sourceConversationId, forkedAtMessageId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify source conversation belongs to user
    const sourceConversation = await ctx.db.get(sourceConversationId);
    if (!sourceConversation || sourceConversation.userId !== userId) {
      throw new Error("Source conversation not found");
    }

    // Get source messages up to and including the fork point
    const sourceMessages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", sourceConversationId)
      )
      .filter((q) => q.eq(q.field("discardedAt"), undefined))
      .order("asc")
      .collect();

    // Find the fork point
    const forkIndex = sourceMessages.findIndex(
      (m) => m.messageId === forkedAtMessageId
    );
    if (forkIndex === -1) {
      throw new Error("Fork point message not found");
    }

    // Get messages up to and including the fork point
    const messagesToFork = sourceMessages.slice(0, forkIndex + 1);

    const now = Date.now();

    // Generate fork title with numbered prefix like "(1)", "(2)", etc.
    let forkTitle: string | undefined;
    if (sourceConversation.title) {
      // Strip any existing "(N) " prefix to get the base title
      const baseTitle = sourceConversation.title.replace(/^\(\d+\)\s*/, "");

      // Find all conversations with this base title pattern to determine next number
      const userConversations = await ctx.db
        .query("conversations")
        .withIndex("by_user_updated", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();

      // Find the highest existing number for this base title
      let maxNumber = 0;
      const pattern = new RegExp(
        `^\\((\\d+)\\)\\s*${baseTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`
      );
      for (const conv of userConversations) {
        if (conv.title) {
          const match = conv.title.match(pattern);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNumber) maxNumber = num;
          }
        }
      }

      forkTitle = `(${maxNumber + 1}) ${baseTitle}`;
    }

    // Create the forked conversation
    const newConversationId = await ctx.db.insert("conversations", {
      userId,
      title: forkTitle,
      model: sourceConversation.model,
      messageCount: messagesToFork.length,
      createdAt: now,
      updatedAt: now,
      forkedFrom: sourceConversationId,
      forkedAtMessageId,
    });

    // Insert the forked messages (marked as wasForked to exclude from billing)
    for (let i = 0; i < messagesToFork.length; i++) {
      const msg = messagesToFork[i];
      await ctx.db.insert("messages", {
        conversationId: newConversationId,
        userId,
        messageId: msg.messageId,
        role: msg.role,
        parts: msg.parts,
        model: msg.model,
        inputTokens: msg.inputTokens,
        outputTokens: msg.outputTokens,
        createdAt: msg.createdAt,
        metadata: msg.metadata,
        wasForked: true, // Mark as forked to exclude from billing
      });
    }

    return newConversationId;
  },
});
