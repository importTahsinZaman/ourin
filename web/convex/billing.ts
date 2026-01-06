import { query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { calculateCredits, getSubscriptionCredits } from "./pricing";
import { isSelfHosting } from "./config";
import type { Id } from "./_generated/dataModel";

const FREE_MODEL_ID = "google:gemini-2.5-flash-lite";
const FREE_MESSAGE_LIMIT = 10;

export type UserTier = "anonymous" | "free" | "subscriber" | "self_hosted";

/**
 * self-hosted tier info - grants unrestricted access to all models.
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
  // free tier specific
  messageCount?: number;
  remainingMessages?: number;
  // subscriber specific - providers list for bYOK (subscriber-only feature)
  providers?: string[];
  subscription?: {
    status: string;
    currentPeriodEnd: number;
    cancelAtPeriodEnd: boolean;
  };
  credits?: {
    subscriptionBalance: number; // balance from monthly subscription (can be 0)
    purchasedBalance: number; // balance from purchased credit packs
    totalBalance: number; // total available credits
    periodEnd: number;
  };
}

/**
 * helper to calculate balance from messages for a subscriber.
 * tokens are stored on uSER messages (saved before streaming).
 * excludes messages where user used their own aPI key.
 * deduplicates by messageId to handle any duplicate message records.
 */
async function calculateSubscriberBalance(
  ctx: QueryCtx,
  userId: Id<"users">,
  periodStart: number
): Promise<number> {
  // get user messages with token data in current period (exclude forked and own-key usage)
  const messages = await ctx.db
    .query("messages")
    .withIndex("by_user_created", (q) => q.eq("userId", userId))
    .filter((q) =>
      q.and(
        q.gte(q.field("createdAt"), periodStart),
        q.eq(q.field("role"), "user"),
        q.neq(q.field("inputTokens"), undefined),
        q.neq(q.field("wasForked"), true),
        q.neq(q.field("usedOwnKey"), true) // exclude messages where own aPI key was used
      )
    )
    .collect();

  // deduplicate by messageId to handle any duplicate records
  const seenMessageIds = new Set<string>();
  let totalUsed = 0;
  for (const msg of messages) {
    // skip duplicates
    if (seenMessageIds.has(msg.messageId)) {
      continue;
    }
    seenMessageIds.add(msg.messageId);

    totalUsed += calculateCredits(
      msg.model ?? "unknown",
      msg.inputTokens ?? 0,
      msg.outputTokens ?? 0
    );
  }

  return getSubscriptionCredits() - totalUsed;
}

/**
 * core logic to compute tier info for an authenticated user.
 * shared between getUserTier and getUserTierById.
 */
async function computeTierInfo(
  ctx: QueryCtx,
  userId: Id<"users">
): Promise<TierInfo> {
  // check for active subscription first (highest priority)
  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  // check for aPI keys
  const apiKeys = await ctx.db
    .query("apiKeys")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const providers = apiKeys.map((k) => k.provider);

  if (subscription?.status === "active") {
    // calculate subscription balance from messages in current period
    const subscriptionBalance = await calculateSubscriberBalance(
      ctx,
      userId,
      subscription.currentPeriodStart
    );

    // get purchased credits balance
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

    // total balance = subscription (capped at 0) + purchased
    const totalBalance = Math.max(0, subscriptionBalance) + purchasedBalance;

    return {
      tier: "subscriber",
      canSendMessage: totalBalance > 0 || providers.length > 0, // can send if has credits oR own keys
      modelsAllowed: "all",
      providers, // include providers so chat route can check for own keys
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

  // note: aPI keys without subscription no longer grant a separate tier.
  // bYOK is now a subscriber-only feature. users with stored aPI keys
  // but no subscription fall through to the free tier below.

  // free signed-in user
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
 * get the current user's tier and access information.
 * this is the main function used to determine what a user can do.
 */
export const getUserTier = query({
  args: {},
  handler: async (ctx): Promise<TierInfo> => {
    // self-hosting mode: grant unrestricted access
    if (isSelfHosting()) {
      return SELF_HOSTED_TIER;
    }

    const userId = await getAuthUserId(ctx);

    // anonymous user
    if (!userId) {
      return {
        tier: "anonymous",
        canSendMessage: true, // checked client-side via localStorage
        modelsAllowed: [FREE_MODEL_ID],
      };
    }

    return computeTierInfo(ctx, userId);
  },
});

/**
 * get tier info by user iD (for server-side use in aPI routes).
 * uses an internal system context approach.
 */
export const getUserTierById = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }): Promise<TierInfo> => {
    // self-hosting mode: grant unrestricted access
    if (isSelfHosting()) {
      return SELF_HOSTED_TIER;
    }

    // anonymous user
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
 * check if a user can use a specific model based on their tier.
 * note: bYOK is now a subscriber-only feature, so aPI keys alone
 * don't grant access to additional models.
 */
export const canUseModel = query({
  args: {
    modelId: v.string(),
    modelProvider: v.string(),
  },
  handler: async (ctx, { modelId, modelProvider: _modelProvider }) => {
    // self-hosting mode: allow all models
    if (isSelfHosting()) {
      return true;
    }

    const userId = await getAuthUserId(ctx);

    // anonymous users can only use free model
    if (!userId) {
      return modelId === FREE_MODEL_ID;
    }

    // check subscription - subscribers can use all models
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (subscription?.status === "active") {
      return true; // subscribers can use all models (including via their own aPI keys)
    }

    // non-subscribers (free tier) can only use free model
    // note: aPI keys without subscription no longer grant model access
    return modelId === FREE_MODEL_ID;
  },
});
