import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  MutationCtx,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { calculateCredits, getSubscriptionCredits } from "./pricing";
import { isSelfHosting } from "./config";
import { internal } from "./_generated/api";
import { Id, Doc } from "./_generated/dataModel";

// ============================================================================
// constants
// ============================================================================

/**
 * number of recent messages to check when finding the last assistant message.
 * set to 5 to handle cases where user sends multiple messages before assistant responds,
 * while keeping the query efficient.
 */
const RECENT_MESSAGES_LOOKUP_LIMIT = 5;

// ============================================================================
// helper functions
// ============================================================================

/** message data for insertion (shared between append and appendInternal) */
interface MessageInput {
  id: string;
  role: string;
  parts: Doc<"messages">["parts"];
  model?: string;
  createdAt?: number;
  metadata?: Record<string, unknown>;
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * shared logic for appending a message to a conversation.
 * used by both `append` (auth-based) and `appendInternal` (userId-based).
 */
async function insertMessageAndUpdateConversation(
  ctx: MutationCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
  conversation: Doc<"conversations">,
  message: MessageInput
): Promise<void> {
  // use model from top-level field, fall back to metadata for backwards compat
  const model =
    message.model ??
    ((message.metadata as Record<string, unknown> | undefined)?.model as
      | string
      | undefined);
  // remove model from metadata to avoid duplication
  const { model: _metaModel, ...metadataWithoutModel } = message.metadata ?? {};

  await ctx.db.insert("messages", {
    conversationId,
    userId,
    messageId: message.id,
    role: message.role,
    parts: message.parts,
    model: model ?? undefined,
    inputTokens: message.inputTokens,
    outputTokens: message.outputTokens,
    createdAt: message.createdAt || Date.now(),
    metadata:
      Object.keys(metadataWithoutModel).length > 0
        ? metadataWithoutModel
        : undefined,
  });

  // update conversation
  await ctx.db.patch(conversationId, {
    messageCount: conversation.messageCount + 1,
    updatedAt: Date.now(),
  });
}

/**
 * calculate total credit usage for a user's messages in a billing period.
 * excludes forked messages and messages using own aPI key.
 */
async function calculatePeriodUsage(
  ctx: MutationCtx,
  userId: string,
  periodStart: number
): Promise<number> {
  const periodMessages = await ctx.db
    .query("messages")
    .withIndex("by_user_created", (q) => q.eq("userId", userId as Id<"users">))
    .filter((q) =>
      q.and(
        q.gte(q.field("createdAt"), periodStart),
        q.eq(q.field("role"), "user"),
        q.neq(q.field("inputTokens"), undefined),
        q.neq(q.field("wasForked"), true),
        q.neq(q.field("usedOwnKey"), true)
      )
    )
    .collect();

  let totalUsed = 0;
  for (const msg of periodMessages) {
    totalUsed += calculateCredits(
      msg.model ?? "unknown",
      msg.inputTokens ?? 0,
      msg.outputTokens ?? 0
    );
  }
  return totalUsed;
}

/**
 * deduct credits from user's purchased credit packages using fIFO (oldest first).
 * returns the total amount actually deducted.
 */
async function deductCreditsFromPurchases(
  ctx: MutationCtx,
  userId: string,
  amount: number
): Promise<number> {
  if (amount <= 0) return 0;

  // get active credit purchases (fIFO - oldest first)
  const activePurchases = await ctx.db
    .query("creditPurchases")
    .withIndex("by_user_status", (q) =>
      q.eq("userId", userId as Id<"users">).eq("status", "active")
    )
    .collect();

  // sort by purchasedAt (oldest first for fIFO)
  activePurchases.sort((a, b) => a.purchasedAt - b.purchasedAt);

  let remainingToDeduct = amount;

  for (const purchase of activePurchases) {
    if (remainingToDeduct <= 0) break;

    const deductFromThis = Math.min(
      purchase.creditsRemaining,
      remainingToDeduct
    );
    const newBalance = purchase.creditsRemaining - deductFromThis;

    await ctx.db.patch(purchase._id, {
      creditsRemaining: newBalance,
      status: newBalance === 0 ? "depleted" : "active",
    });

    remainingToDeduct -= deductFromThis;
  }

  return amount - remainingToDeduct;
}

// metadata validator - flexible but typed
const metadataValidator = v.optional(
  v.object({
    coreNames: v.optional(v.array(v.string())),
    reasoningLevel: v.optional(v.union(v.string(), v.number())),
    thinkingDuration: v.optional(v.number()),
    webSearchEnabled: v.optional(v.boolean()),
    model: v.optional(v.string()), // for backwards compatibility
  })
);

// tool invocation args validator - jSON-serializable values
const toolArgsValidator = v.union(
  v.string(),
  v.number(),
  v.boolean(),
  v.null(),
  v.array(v.any()),
  v.object({})
);

// message part validator
const messagePartValidator = v.union(
  v.object({
    type: v.literal("text"),
    text: v.string(),
  }),
  v.object({
    type: v.literal("file"),
    mediaType: v.string(),
    url: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    fileName: v.string(),
    fileSize: v.optional(v.number()),
  }),
  v.object({
    type: v.literal("reasoning"),
    text: v.string(),
    id: v.optional(v.string()), // for tracking separate reasoning blocks in interleaved thinking
    duration: v.optional(v.number()), // duration in seconds this block took
  }),
  v.object({
    type: v.literal("tool-invocation"),
    toolInvocationId: v.string(),
    toolName: v.string(),
    args: v.any(),
    state: v.union(v.literal("call"), v.literal("result")),
    result: v.optional(v.any()),
  }),
  v.object({
    type: v.literal("sources"),
    sources: v.array(
      v.object({
        title: v.string(),
        url: v.string(),
        snippet: v.optional(v.string()),
      })
    ),
  })
);

// get all messages for a conversation (excludes discarded messages and deleted conversations)
export const getByConversation = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // verify conversation belongs to user and is not deleted
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== userId) return [];
    if (conversation.deletedAt) return []; // don't return messages for deleted conversations

    // get non-discarded messages only
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", conversationId)
      )
      .filter((q) => q.eq(q.field("discardedAt"), undefined))
      .order("asc")
      .collect();

    // generate signed uRLs for any file attachments and include model
    const messagesWithUrls = await Promise.all(
      messages.map(async (msg) => {
        const partsWithUrls = await Promise.all(
          msg.parts.map(async (part) => {
            if (part.type === "file" && part.storageId && !part.url) {
              const url = await ctx.storage.getUrl(part.storageId);
              return { ...part, url };
            }
            return part;
          })
        );
        // prefer model column over metadata.model for backwards compatibility
        const metadata = msg.metadata as Record<string, unknown> | undefined;
        const model = msg.model ?? (metadata?.model as string | undefined);
        return {
          id: msg.messageId,
          role: msg.role,
          parts: partsWithUrls,
          model,
          createdAt: msg.createdAt,
          metadata: msg.metadata,
        };
      })
    );

    return messagesWithUrls;
  },
});

// append a single message to a conversation
export const append = mutation({
  args: {
    conversationId: v.id("conversations"),
    message: v.object({
      id: v.string(),
      role: v.string(),
      parts: v.array(messagePartValidator),
      model: v.optional(v.string()),
      createdAt: v.optional(v.number()),
      metadata: v.optional(v.any()),
      // token usage (only for assistant messages)
      inputTokens: v.optional(v.number()),
      outputTokens: v.optional(v.number()),
    }),
  },
  handler: async (ctx, { conversationId, message }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // verify conversation belongs to user
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }

    await insertMessageAndUpdateConversation(
      ctx,
      conversationId,
      userId,
      conversation,
      message as MessageInput
    );
  },
});

// update token usage on the last non-discarded user message (server-only - called from aPI routes)
// we store tokens on user messages because they're saved immediately before streaming,
// so they're guaranteed to exist when the aPI finishes.
// also handles automatic deduction of purchased credits when subscription is depleted (production mode only).
// if usedOwnKey is true, skip credit deduction (user used their own aPI key).
// requires serverSecret to prevent client-side abuse.
export const updateTokens = mutation({
  args: {
    conversationId: v.string(), // string from aPI route
    userId: v.string(), // user iD for billing lookups
    model: v.string(), // model used for credit calculation
    inputTokens: v.number(),
    outputTokens: v.number(),
    usedOwnKey: v.optional(v.boolean()), // whether user's own aPI key was used
    serverSecret: v.string(),
  },
  handler: async (
    ctx,
    {
      conversationId,
      userId,
      model,
      inputTokens,
      outputTokens,
      usedOwnKey,
      serverSecret,
    }
  ) => {
    // verify server secret to prevent client-side calls
    const expectedSecret = process.env.CHAT_AUTH_SECRET;
    if (!expectedSecret || serverSecret !== expectedSecret) {
      throw new Error("Unauthorized");
    }

    // find the last non-discarded user message in the conversation
    const message = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", conversationId as Id<"conversations">)
      )
      .order("desc")
      .filter((q) =>
        q.and(
          q.eq(q.field("role"), "user"),
          q.eq(q.field("discardedAt"), undefined)
        )
      )
      .first();

    if (!message) {
      console.warn(`No user message found in conversation ${conversationId}`);
      return { tokensUpdated: false, creditsDeducted: 0 };
    }

    // update token counts and usedOwnKey flag on the message
    await ctx.db.patch(message._id, {
      inputTokens,
      outputTokens,
      ...(usedOwnKey !== undefined && { usedOwnKey }),
    });

    // in self-hosting mode, skip all credit deduction logic
    // token tracking is still done for usage analytics
    if (isSelfHosting()) {
      return { tokensUpdated: true, creditsDeducted: 0 };
    }

    // if user used their own aPI key, skip credit deduction
    if (usedOwnKey) {
      return { tokensUpdated: true, creditsDeducted: 0 };
    }

    // check if user has an active subscription
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId as Id<"users">))
      .first();

    if (!subscription || subscription.status !== "active") {
      // no active subscription - just token tracking, no credit deduction needed
      return { tokensUpdated: true, creditsDeducted: 0 };
    }

    // calculate the cost of this message
    const messageCost = calculateCredits(model, inputTokens, outputTokens);

    // calculate total subscription usage (including this message since it's already patched)
    const totalUsed = await calculatePeriodUsage(
      ctx,
      userId,
      subscription.currentPeriodStart
    );
    const subscriptionBalance = getSubscriptionCredits() - totalUsed;

    // if subscription has enough credits, no need to deduct from purchased
    if (subscriptionBalance >= 0) {
      return { tokensUpdated: true, creditsDeducted: 0 };
    }

    // subscription is depleted - need to deduct from purchased credits
    // the overage is how much we need to deduct (negative balance = overage)
    const toDeduct = Math.min(messageCost, Math.abs(subscriptionBalance));
    const totalDeducted = await deductCreditsFromPurchases(
      ctx,
      userId,
      toDeduct
    );

    if (totalDeducted > 0) {
      console.log(
        `Auto-deducted ${totalDeducted} purchased credits for user ${userId} (${model}: ${inputTokens} in, ${outputTokens} out)`
      );
    }

    return { tokensUpdated: true, creditsDeducted: totalDeducted };
  },
});

// append a message (internal - for aPI routes with userId)
export const appendInternal = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    message: v.object({
      id: v.string(),
      role: v.string(),
      parts: v.array(messagePartValidator),
      model: v.optional(v.string()),
      createdAt: v.optional(v.number()),
      metadata: v.optional(v.any()),
      inputTokens: v.optional(v.number()),
      outputTokens: v.optional(v.number()),
    }),
  },
  handler: async (ctx, { conversationId, userId, message }) => {
    // verify conversation exists and belongs to user
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }

    await insertMessageAndUpdateConversation(
      ctx,
      conversationId,
      userId,
      conversation,
      message as MessageInput
    );
  },
});

// soft-delete messages from a specific point onwards (for editing/regenerating)
// uses soft delete to preserve token usage data for accurate billing
export const truncateFrom = mutation({
  args: {
    conversationId: v.id("conversations"),
    fromMessageId: v.string(),
  },
  handler: async (ctx, { conversationId, fromMessageId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // verify conversation belongs to user
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }

    // get all non-discarded messages
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", conversationId)
      )
      .filter((q) => q.eq(q.field("discardedAt"), undefined))
      .order("asc")
      .collect();

    // find the index of the message to truncate from
    const truncateIndex = messages.findIndex(
      (m) => m.messageId === fromMessageId
    );

    if (truncateIndex === -1) {
      throw new Error("Message not found");
    }

    // soft-delete messages from that point onwards (mark as discarded)
    const now = Date.now();
    const toDiscard = messages.slice(truncateIndex);
    for (const msg of toDiscard) {
      await ctx.db.patch(msg._id, { discardedAt: now });
    }

    // update conversation message count (only count non-discarded messages)
    await ctx.db.patch(conversationId, {
      messageCount: truncateIndex,
      updatedAt: now,
    });

    return truncateIndex;
  },
});

/**
 * reconcile purchased credits for a user.
 * calculates what sHOULD be charged vs what iS charged, and adjusts accordingly.
 * called internally after token edits.
 * only runs in production mode (not self-hosting).
 */
export const reconcilePurchasedCredits = internalMutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    // skip in self-hosting mode
    if (isSelfHosting()) {
      return { adjusted: 0 };
    }

    // get user's active subscription
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId as Id<"users">))
      .first();

    if (!subscription || subscription.status !== "active") {
      return { adjusted: 0 };
    }

    // calculate total subscription usage for current period
    const totalUsed = await calculatePeriodUsage(
      ctx,
      userId,
      subscription.currentPeriodStart
    );

    // calculate how much sHOULD be charged from purchased credits
    const overage = Math.max(0, totalUsed - getSubscriptionCredits());

    // get all purchases to calculate what's currently charged
    const allPurchases = await ctx.db
      .query("creditPurchases")
      .withIndex("by_user", (q) => q.eq("userId", userId as Id<"users">))
      .collect();

    if (allPurchases.length === 0) {
      return { adjusted: 0 };
    }

    // calculate total currently charged from purchases
    const totalCharged = allPurchases.reduce(
      (sum, p) => sum + (p.creditsAmount - p.creditsRemaining),
      0
    );

    // calculate the difference
    const adjustment = overage - totalCharged;

    if (adjustment === 0) {
      return { adjusted: 0 };
    }

    if (adjustment > 0) {
      // need to dEDUCT more credits - use fIFO helper
      const deducted = await deductCreditsFromPurchases(
        ctx,
        userId,
        adjustment
      );
      console.log(
        `Reconciled: Deducted ${deducted} credits for user ${userId}`
      );
      return { adjusted: -deducted };
    } else {
      // need to rEFUND credits (adjustment is negative)
      // refund to purchases in reverse order (most recent first) - different from fIFO deduction
      let remainingToRefund = Math.abs(adjustment);

      // sort by purchasedAt (most recent first for refunds)
      allPurchases.sort((a, b) => b.purchasedAt - a.purchasedAt);

      for (const purchase of allPurchases) {
        if (remainingToRefund <= 0) break;

        const maxRefund = purchase.creditsAmount - purchase.creditsRemaining;
        if (maxRefund <= 0) continue;

        const refundToThis = Math.min(maxRefund, remainingToRefund);
        const newBalance = purchase.creditsRemaining + refundToThis;

        await ctx.db.patch(purchase._id, {
          creditsRemaining: newBalance,
          status: newBalance > 0 ? "active" : "depleted",
        });

        remainingToRefund -= refundToThis;
      }

      const refunded = Math.abs(adjustment) - remainingToRefund;
      console.log(
        `Reconciled: Refunded ${refunded} credits for user ${userId}`
      );
      return { adjusted: refunded };
    }
  },
});

// create an empty streaming assistant message (called immediately when streaming starts)
export const createStreamingMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    messageId: v.string(),
    model: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, { conversationId, messageId, model, metadata }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }

    // create empty assistant message with placeholder text part
    await ctx.db.insert("messages", {
      conversationId,
      userId,
      messageId,
      role: "assistant",
      parts: [{ type: "text" as const, text: "" }],
      model,
      createdAt: Date.now(),
      metadata,
    });

    // update conversation message count
    await ctx.db.patch(conversationId, {
      messageCount: conversation.messageCount + 1,
      updatedAt: Date.now(),
    });
  },
});

// update a streaming message's parts (called every 250ms during streaming)
export const updateStreamingMessage = mutation({
  args: {
    messageId: v.string(),
    conversationId: v.id("conversations"),
    parts: v.array(messagePartValidator),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, { messageId, conversationId, parts, metadata }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // find the message by messageId within the conversation
    const message = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", conversationId)
      )
      .filter((q) => q.eq(q.field("messageId"), messageId))
      .first();

    if (!message || message.userId !== userId) {
      // message might not exist yet if createStreamingMessage hasn't completed
      // this is fine - just skip this update
      return;
    }

    // update parts and optionally metadata
    await ctx.db.patch(message._id, {
      parts,
      ...(metadata !== undefined && { metadata }),
    });
  },
});

// add sources to the last assistant message in a conversation (for web search results)
export const addSourcesToLastAssistant = mutation({
  args: {
    conversationId: v.string(), // string from aPI route
    sources: v.array(
      v.object({
        title: v.string(),
        url: v.string(),
        snippet: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { conversationId, sources }) => {
    if (sources.length === 0) return;

    // verify the user owns this conversation
    const conversation = await ctx.db.get(
      conversationId as Id<"conversations">
    );
    if (!conversation) {
      console.warn(`Conversation ${conversationId} not found`);
      return;
    }

    const userId = await getAuthUserId(ctx);
    if (!userId || conversation.userId !== userId) {
      console.warn(
        `User not authorized to modify conversation ${conversationId}`
      );
      return;
    }

    // get the last few messages to find the assistant message
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", conversationId as Id<"conversations">)
      )
      .order("desc")
      .take(RECENT_MESSAGES_LOOKUP_LIMIT);

    const lastAssistant = messages.find(
      (m) => m.role === "assistant" && !m.discardedAt
    );
    if (!lastAssistant) {
      console.warn(
        `No assistant message found in conversation ${conversationId}`
      );
      return;
    }

    // add sources part to the message parts
    const updatedParts = [
      ...lastAssistant.parts,
      { type: "sources" as const, sources },
    ];

    await ctx.db.patch(lastAssistant._id, { parts: updatedParts });
  },
});
