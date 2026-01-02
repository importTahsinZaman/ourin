import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { calculateCredits, getSubscriptionCredits } from "./pricing";
import { isSelfHosting } from "./config";
import type { Doc } from "./_generated/dataModel";

/**
 * calculate usage summary for the current billing period.
 * usage is calculated from user messages with token data.
 * (tokens are stored on user messages since they're saved before streaming)
 *
 * in self-hosting mode, returns token usage only (no credit calculations).
 */
export const getUsageSummary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // in self-hosting mode, return simplified usage stats (just tokens, no credits)
    if (isSelfHosting()) {
      // get all user messages with token data
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_user_created", (q) => q.eq("userId", userId))
        .filter((q) =>
          q.and(
            q.eq(q.field("role"), "user"),
            q.neq(q.field("inputTokens"), undefined)
          )
        )
        .collect();

      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      const byModel: Record<
        string,
        { count: number; tokens: number; credits: number }
      > = {};

      for (const msg of messages) {
        const inputTokens = msg.inputTokens ?? 0;
        const outputTokens = msg.outputTokens ?? 0;
        const model = msg.model ?? "unknown";

        totalInputTokens += inputTokens;
        totalOutputTokens += outputTokens;

        if (!byModel[model]) {
          byModel[model] = { count: 0, tokens: 0, credits: 0 };
        }
        byModel[model].count++;
        byModel[model].tokens += inputTokens + outputTokens;
        // credits stays 0 in self-hosting mode
      }

      return {
        isSelfHosting: true,
        totalInputTokens,
        totalOutputTokens,
        messageCount: messages.length,
        byModel,
        // credit fields not applicable in self-hosting mode
        subscriptionBalance: null,
        purchasedBalance: null,
        purchasedTotal: null,
        totalBalance: null,
        totalCreditsUsed: null,
        periodStart: null,
        periodEnd: null,
      };
    }

    // get subscription for period info
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!subscription || subscription.status !== "active") {
      return null;
    }

    const periodStart = subscription.currentPeriodStart;
    const periodEnd = subscription.currentPeriodEnd;

    // get user messages with token data in current period (exclude forked messages)
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.and(
          q.gte(q.field("createdAt"), periodStart),
          q.eq(q.field("role"), "user"),
          q.neq(q.field("inputTokens"), undefined),
          q.neq(q.field("wasForked"), true)
        )
      )
      .collect();

    // calculate totals
    let totalCreditsUsed = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const byModel: Record<
      string,
      { count: number; tokens: number; credits: number }
    > = {};

    for (const msg of messages) {
      const inputTokens = msg.inputTokens ?? 0;
      const outputTokens = msg.outputTokens ?? 0;
      const model = msg.model ?? "unknown";
      const credits = calculateCredits(model, inputTokens, outputTokens);

      totalCreditsUsed += credits;
      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;

      if (!byModel[model]) {
        byModel[model] = { count: 0, tokens: 0, credits: 0 };
      }
      byModel[model].count++;
      byModel[model].tokens += inputTokens + outputTokens;
      byModel[model].credits += credits;
    }

    // calculate subscription balance (can be negative if overspent)
    const subscriptionBalance = getSubscriptionCredits() - totalCreditsUsed;

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

    const purchasedTotal = activePurchases.reduce(
      (sum, p) => sum + p.creditsAmount,
      0
    );

    // total balance = subscription (capped at 0) + purchased
    const totalBalance = Math.max(0, subscriptionBalance) + purchasedBalance;

    return {
      isSelfHosting: false,
      subscriptionBalance: Math.max(0, subscriptionBalance),
      purchasedBalance,
      purchasedTotal,
      totalBalance,
      periodStart,
      periodEnd,
      totalCreditsUsed,
      totalInputTokens,
      totalOutputTokens,
      messageCount: messages.length,
      byModel,
    };
  },
});

/**
 * get usage history for the current user.
 */
export const getUsageHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 50 }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // get user messages with token data (exclude forked messages)
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("role"), "user"),
          q.neq(q.field("inputTokens"), undefined),
          q.neq(q.field("wasForked"), true)
        )
      )
      .order("desc")
      .take(limit);

    return messages.map((msg) => ({
      messageId: msg.messageId,
      model: msg.model ?? "unknown",
      inputTokens: msg.inputTokens ?? 0,
      outputTokens: msg.outputTokens ?? 0,
      credits: calculateCredits(
        msg.model ?? "unknown",
        msg.inputTokens ?? 0,
        msg.outputTokens ?? 0
      ),
      createdAt: msg.createdAt,
    }));
  },
});
