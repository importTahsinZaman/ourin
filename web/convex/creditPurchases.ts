import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { calculateCredits } from "./pricing";
import type { Id } from "./_generated/dataModel";

// NOTE: CREDIT_PACK_AMOUNT and CREDIT_PACK_PRICE_CENTS are now in Convex env vars.
// Use getCreditPackAmount() and getCreditPackPriceCents() from ./pricing

/**
 * Record a new credit pack purchase.
 * Called by webhook after successful Stripe payment.
 * Idempotent - checks for existing purchase by payment intent ID.
 */
export const recordPurchase = mutation({
  args: {
    userId: v.string(),
    stripePaymentIntentId: v.string(),
    stripeCheckoutSessionId: v.optional(v.string()),
    creditsAmount: v.number(),
    centsPaid: v.number(),
  },
  handler: async (ctx, args) => {
    // Idempotency check - don't create duplicate records
    const existing = await ctx.db
      .query("creditPurchases")
      .withIndex("by_payment_intent", (q) =>
        q.eq("stripePaymentIntentId", args.stripePaymentIntentId)
      )
      .first();

    if (existing) {
      console.log(
        "Credit purchase already recorded:",
        args.stripePaymentIntentId
      );
      return existing._id;
    }

    // Create new purchase record
    // Cast string userId to Id<"users"> for database insertion
    const purchaseId = await ctx.db.insert("creditPurchases", {
      userId: args.userId as Id<"users">,
      stripePaymentIntentId: args.stripePaymentIntentId,
      stripeCheckoutSessionId: args.stripeCheckoutSessionId,
      creditsAmount: args.creditsAmount,
      centsPaid: args.centsPaid,
      creditsRemaining: args.creditsAmount,
      status: "active",
      purchasedAt: Date.now(),
    });

    console.log(
      `Credit pack recorded: ${args.creditsAmount} credits for user ${args.userId}`
    );
    return purchaseId;
  },
});

/**
 * Get total purchased credits balance for the authenticated user.
 */
export const getPurchasedBalance = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { balance: 0, purchases: [] };
    }

    const activePurchases = await ctx.db
      .query("creditPurchases")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "active")
      )
      .collect();

    const balance = activePurchases.reduce(
      (sum, p) => sum + p.creditsRemaining,
      0
    );

    return {
      balance,
      purchases: activePurchases.map((p) => ({
        id: p._id,
        creditsRemaining: p.creditsRemaining,
        creditsAmount: p.creditsAmount,
        purchasedAt: p.purchasedAt,
      })),
    };
  },
});

/**
 * Get purchased credits balance by user ID (for server-side use).
 */
export const getPurchasedBalanceByUserId = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    // Cast string userId to Id<"users"> for database queries
    const activePurchases = await ctx.db
      .query("creditPurchases")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId as Id<"users">).eq("status", "active")
      )
      .collect();

    return activePurchases.reduce((sum, p) => sum + p.creditsRemaining, 0);
  },
});

/**
 * Deduct credits from purchased packs (FIFO order - oldest first).
 * Called when subscription credits are depleted and purchased credits are used.
 * Calculates the cost internally using the shared pricing module.
 */
export const deductPurchasedCredits = mutation({
  args: {
    userId: v.string(),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
  },
  handler: async (ctx, { userId, model, inputTokens, outputTokens }) => {
    // Calculate cost using shared pricing (with markup)
    const amount = calculateCredits(model, inputTokens, outputTokens);

    if (amount <= 0) {
      return { deducted: 0, remaining: 0, cost: 0 };
    }

    // Get active purchases
    // Cast string userId to Id<"users"> for database queries
    const activePurchases = await ctx.db
      .query("creditPurchases")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId as Id<"users">).eq("status", "active")
      )
      .collect();

    // Sort by purchasedAt (oldest first - FIFO)
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

    const totalDeducted = amount - remainingToDeduct;
    console.log(
      `Deducted ${totalDeducted} purchased credits for user ${userId} (${model}: ${inputTokens} in, ${outputTokens} out)`
    );

    return {
      deducted: totalDeducted,
      remaining: remainingToDeduct,
      cost: amount,
    };
  },
});

/**
 * Get purchase history for the authenticated user.
 */
export const getPurchaseHistory = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const purchases = await ctx.db
      .query("creditPurchases")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);

    return purchases.map((p) => ({
      id: p._id,
      creditsAmount: p.creditsAmount,
      creditsRemaining: p.creditsRemaining,
      centsPaid: p.centsPaid,
      status: p.status,
      purchasedAt: p.purchasedAt,
    }));
  },
});
