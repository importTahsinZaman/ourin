import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { calculateCredits } from "./pricing";
import type { Id } from "./_generated/dataModel";

// nOTE: cREDIT_pACK_aMOUNT and cREDIT_pACK_pRICE_cENTS are now in convex env vars.
// use getCreditPackAmount() and getCreditPackPriceCents() from ./pricing

/**
 * record a new credit pack purchase.
 * called by webhook after successful stripe payment.
 * idempotent - checks for existing purchase by payment intent iD.
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
    // idempotency check - don't create duplicate records
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

    // create new purchase record
    // cast string userId to id<"users"> for database insertion
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
 * get total purchased credits balance for the authenticated user.
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
 * get purchased credits balance by user iD (for server-side use).
 */
export const getPurchasedBalanceByUserId = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    // cast string userId to id<"users"> for database queries
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
 * deduct credits from purchased packs (fIFO order - oldest first).
 * called when subscription credits are depleted and purchased credits are used.
 * calculates the cost internally using the shared pricing module.
 */
export const deductPurchasedCredits = mutation({
  args: {
    userId: v.string(),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
  },
  handler: async (ctx, { userId, model, inputTokens, outputTokens }) => {
    // calculate cost using shared pricing (with markup)
    const amount = calculateCredits(model, inputTokens, outputTokens);

    if (amount <= 0) {
      return { deducted: 0, remaining: 0, cost: 0 };
    }

    // get active purchases
    // cast string userId to id<"users"> for database queries
    const activePurchases = await ctx.db
      .query("creditPurchases")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId as Id<"users">).eq("status", "active")
      )
      .collect();

    // sort by purchasedAt (oldest first - fIFO)
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
 * get purchase history for the authenticated user.
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
