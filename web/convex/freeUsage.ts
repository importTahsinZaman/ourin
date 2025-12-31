import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isSelfHosting } from "./config";
import type { Id } from "./_generated/dataModel";

const FREE_MESSAGE_LIMIT = 10;

/**
 * Get the current free tier usage for the authenticated user.
 * In self-hosting mode, returns unlimited usage.
 */
export const getFreeUsage = query({
  args: {},
  handler: async (ctx) => {
    // In self-hosting mode, return unlimited usage
    // Note: null remainingMessages means unlimited (Infinity is not JSON-serializable)
    if (isSelfHosting()) {
      return {
        messageCount: 0,
        remainingMessages: null,
        lastMessageAt: null,
      };
    }

    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const usage = await ctx.db
      .query("freeUsage")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return usage
      ? {
          messageCount: usage.messageCount,
          remainingMessages: Math.max(
            0,
            FREE_MESSAGE_LIMIT - usage.messageCount
          ),
          lastMessageAt: usage.lastMessageAt,
        }
      : {
          messageCount: 0,
          remainingMessages: FREE_MESSAGE_LIMIT,
          lastMessageAt: null,
        };
  },
});

/**
 * Increment the free tier message count.
 * Returns the new count and whether the user can still send messages.
 * In self-hosting mode, this is a no-op.
 */
export const incrementFreeUsage = mutation({
  args: {},
  handler: async (ctx) => {
    // In self-hosting mode, no-op
    if (isSelfHosting()) {
      return {
        messageCount: 0,
        remainingMessages: null,
        canSendMore: true,
      };
    }

    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const usage = await ctx.db
      .query("freeUsage")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const now = Date.now();

    if (usage) {
      const newCount = usage.messageCount + 1;
      await ctx.db.patch(usage._id, {
        messageCount: newCount,
        lastMessageAt: now,
      });
      return {
        messageCount: newCount,
        remainingMessages: Math.max(0, FREE_MESSAGE_LIMIT - newCount),
        canSendMore: newCount < FREE_MESSAGE_LIMIT,
      };
    } else {
      await ctx.db.insert("freeUsage", {
        userId,
        messageCount: 1,
        lastMessageAt: now,
      });
      return {
        messageCount: 1,
        remainingMessages: FREE_MESSAGE_LIMIT - 1,
        canSendMore: true,
      };
    }
  },
});

/**
 * Check if the user can send a free message.
 * In self-hosting mode, always returns true.
 */
export const canSendFreeMessage = query({
  args: {},
  handler: async (ctx) => {
    // In self-hosting mode, always allow
    if (isSelfHosting()) {
      return true;
    }

    const userId = await getAuthUserId(ctx);
    if (!userId) return false;

    const usage = await ctx.db
      .query("freeUsage")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return (usage?.messageCount ?? 0) < FREE_MESSAGE_LIMIT;
  },
});

/**
 * Reset free usage (for testing or admin purposes).
 */
export const resetFreeUsage = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const usage = await ctx.db
      .query("freeUsage")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (usage) {
      await ctx.db.patch(usage._id, {
        messageCount: 0,
        lastMessageAt: Date.now(),
      });
    }
  },
});

/**
 * Increment free usage (server-only - called from API routes with userId).
 * This is used by the chat API route after verifying the user via chat token.
 * Requires serverSecret to prevent client-side abuse.
 * In self-hosting mode, this is a no-op.
 */
export const incrementFreeUsageInternal = mutation({
  args: {
    userId: v.string(),
    serverSecret: v.string(),
  },
  handler: async (ctx, args) => {
    // In self-hosting mode, skip free usage tracking entirely
    if (isSelfHosting()) {
      return { messageCount: 0 };
    }

    // Verify server secret to prevent client-side calls
    const expectedSecret = process.env.CHAT_AUTH_SECRET;
    if (!expectedSecret || args.serverSecret !== expectedSecret) {
      throw new Error("Unauthorized");
    }

    // Cast string userId to Id<"users"> for database queries
    const userIdTyped = args.userId as Id<"users">;

    const usage = await ctx.db
      .query("freeUsage")
      .withIndex("by_user", (q) => q.eq("userId", userIdTyped))
      .first();

    const now = Date.now();

    if (usage) {
      const newCount = usage.messageCount + 1;
      await ctx.db.patch(usage._id, {
        messageCount: newCount,
        lastMessageAt: now,
      });
      return { messageCount: newCount };
    } else {
      await ctx.db.insert("freeUsage", {
        userId: userIdTyped,
        messageCount: 1,
        lastMessageAt: now,
      });
      return { messageCount: 1 };
    }
  },
});
