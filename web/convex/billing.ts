import { query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { calculateCredits, getSubscriptionCredits } from "./pricing";
import { isSelfHosting } from "./config";
import type { Id, Doc } from "./_generated/dataModel";

const FREE_MODEL_ID = "google:gemini-2.5-flash-lite";
const FREE_MESSAGE_LIMIT = 10;

export type UserTier =
  | "anonymous"
  | "free"
  | "own_keys"
  | "subscriber"
  | "self_hosted";

/**
 * Self-hosted tier info - grants unrestricted access to all models.
 */
const SELF_HOSTED_TIER: TierInfo = {
  tier: "self_hosted",
  canSendMessage: true,
  modelsAllowed: "all",
};

export interface TierInfo {
  tier: UserTier;
  canSendMessage: boolean;
  modelsAllowed: string[] | "all";
  // Free tier specific
  messageCount?: number;
  remainingMessages?: number;
  // Own keys specific
  providers?: string[];
  // Subscriber specific
  subscription?: {
    status: string;
    currentPeriodEnd: number;
    cancelAtPeriodEnd: boolean;
  };
  credits?: {
    subscriptionBalance: number; // Balance from monthly subscription (can be 0)
    purchasedBalance: number; // Balance from purchased credit packs
    totalBalance: number; // Total available credits
    periodEnd: number;
  };
}

/**
 * Helper to calculate balance from messages for a subscriber.
 * Tokens are stored on USER messages (saved before streaming).
 * Excludes messages where user used their own API key.
 */
async function calculateSubscriberBalance(
  ctx: QueryCtx,
  userId: Id<"users">,
  periodStart: number
): Promise<number> {
  // Get user messages with token data in current period (exclude forked and own-key usage)
  const messages = await ctx.db
    .query("messages")
    .withIndex("by_user_created", (q) => q.eq("userId", userId))
    .filter((q) =>
      q.and(
        q.gte(q.field("createdAt"), periodStart),
        q.eq(q.field("role"), "user"),
        q.neq(q.field("inputTokens"), undefined),
        q.neq(q.field("wasForked"), true),
        q.neq(q.field("usedOwnKey"), true) // Exclude messages where own API key was used
      )
    )
    .collect();

  let totalUsed = 0;
  for (const msg of messages) {
    totalUsed += calculateCredits(
      msg.model ?? "unknown",
      msg.inputTokens ?? 0,
      msg.outputTokens ?? 0
    );
  }

  return getSubscriptionCredits() - totalUsed;
}

/**
 * Core logic to compute tier info for an authenticated user.
 * Shared between getUserTier and getUserTierById.
 */
async function computeTierInfo(
  ctx: QueryCtx,
  userId: Id<"users">
): Promise<TierInfo> {
  // Check for active subscription first (highest priority)
  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  // Check for API keys
  const apiKeys = await ctx.db
    .query("apiKeys")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const providers = apiKeys.map((k) => k.provider);

  if (subscription?.status === "active") {
    // Calculate subscription balance from messages in current period
    const subscriptionBalance = await calculateSubscriberBalance(
      ctx,
      userId,
      subscription.currentPeriodStart
    );

    // Get purchased credits balance
    const activePurchases = await ctx.db
      .query("creditPurchases")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "active")
      )
      .collect();

    const purchasedBalance = activePurchases.reduce(
      (sum, p) => sum + p.creditsRemaining,
      0
    );

    // Total balance = subscription (capped at 0) + purchased
    const totalBalance = Math.max(0, subscriptionBalance) + purchasedBalance;

    return {
      tier: "subscriber",
      canSendMessage: totalBalance > 0 || providers.length > 0, // Can send if has credits OR own keys
      modelsAllowed: "all",
      providers, // Include providers so chat route can check for own keys
      subscription: {
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      },
      credits: {
        subscriptionBalance: Math.max(0, subscriptionBalance),
        purchasedBalance,
        totalBalance,
        periodEnd: subscription.currentPeriodEnd,
      },
    };
  }

  // Check for API keys (second priority)
  if (apiKeys.length > 0) {
    return {
      tier: "own_keys",
      canSendMessage: true,
      modelsAllowed: providers, // Provider names to match against model provider
      providers,
    };
  }

  // Free signed-in user (lowest priority)
  const freeUsage = await ctx.db
    .query("freeUsage")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  const messageCount = freeUsage?.messageCount ?? 0;
  const remainingMessages = Math.max(0, FREE_MESSAGE_LIMIT - messageCount);

  return {
    tier: "free",
    canSendMessage: messageCount < FREE_MESSAGE_LIMIT,
    modelsAllowed: [FREE_MODEL_ID],
    messageCount,
    remainingMessages,
  };
}

/**
 * Get the current user's tier and access information.
 * This is the main function used to determine what a user can do.
 */
export const getUserTier = query({
  args: {},
  handler: async (ctx): Promise<TierInfo> => {
    // Self-hosting mode: grant unrestricted access
    if (isSelfHosting()) {
      return SELF_HOSTED_TIER;
    }

    const userId = await getAuthUserId(ctx);

    // Anonymous user
    if (!userId) {
      return {
        tier: "anonymous",
        canSendMessage: true, // Checked client-side via localStorage
        modelsAllowed: [FREE_MODEL_ID],
      };
    }

    return computeTierInfo(ctx, userId);
  },
});

/**
 * Get tier info by user ID (for server-side use in API routes).
 * Uses an internal system context approach.
 */
export const getUserTierById = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }): Promise<TierInfo> => {
    // Self-hosting mode: grant unrestricted access
    if (isSelfHosting()) {
      return SELF_HOSTED_TIER;
    }

    // Anonymous user
    if (userId === "anonymous") {
      return {
        tier: "anonymous",
        canSendMessage: true,
        modelsAllowed: [FREE_MODEL_ID],
      };
    }

    return computeTierInfo(ctx, userId as Id<"users">);
  },
});

/**
 * Check if a user can use a specific model based on their tier.
 */
export const canUseModel = query({
  args: {
    modelId: v.string(),
    modelProvider: v.string(),
  },
  handler: async (ctx, { modelId, modelProvider }) => {
    // Self-hosting mode: allow all models
    if (isSelfHosting()) {
      return true;
    }

    const userId = await getAuthUserId(ctx);

    // Anonymous users can only use free model
    if (!userId) {
      return modelId === FREE_MODEL_ID;
    }

    // Check subscription
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (subscription?.status === "active") {
      return true; // Subscribers can use all models
    }

    // Check API keys for the model's provider
    const apiKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", userId).eq("provider", modelProvider)
      )
      .first();

    if (apiKey) {
      return true; // Has API key for this provider
    }

    // Free user can only use free model
    return modelId === FREE_MODEL_ID;
  },
});
