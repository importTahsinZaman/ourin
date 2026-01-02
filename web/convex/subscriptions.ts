import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

/**
 * validate period timestamps are valid numbers.
 */
function validatePeriod(start: number, end: number): void {
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error(`Invalid subscription period: start=${start}, end=${end}`);
  }
  if (start <= 0 || end <= 0) {
    throw new Error(
      `Invalid subscription period values: start=${start}, end=${end}`
    );
  }
  if (end <= start) {
    throw new Error(
      `Period end must be after start: start=${start}, end=${end}`
    );
  }
}

/**
 * create a new subscription record.
 * called by the stripe webhook when checkout completes.
 */
export const createSubscription = mutation({
  args: {
    userId: v.string(),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    status: v.string(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    // validate period data before storing
    validatePeriod(args.currentPeriodStart, args.currentPeriodEnd);

    const now = Date.now();

    // check if subscription already exists
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_subscription", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId)
      )
      .first();

    if (existing) {
      // update existing subscription
      await ctx.db.patch(existing._id, {
        status: args.status,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        updatedAt: now,
      });
      return existing._id;
    }

    // create new subscription
    // cast string userId to id<"users"> for database insertion
    return await ctx.db.insert("subscriptions", {
      userId: args.userId as Id<"users">,
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      status: args.status,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * update subscription status.
 * called by the stripe webhook on subscription updates.
 */
export const updateSubscription = mutation({
  args: {
    stripeSubscriptionId: v.string(),
    status: v.string(),
    cancelAtPeriodEnd: v.boolean(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    // validate period data before storing
    validatePeriod(args.currentPeriodStart, args.currentPeriodEnd);

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_subscription", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId)
      )
      .first();

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    await ctx.db.patch(subscription._id, {
      status: args.status,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      updatedAt: Date.now(),
    });
  },
});

/**
 * get subscription for the current user.
 */
export const getSubscription = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    return await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

/**
 * get subscription by user iD (for aPI routes).
 */
export const getSubscriptionByUserId = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    // cast string userId to id<"users"> for database queries
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId as Id<"users">))
      .first();
  },
});

/**
 * check if user has an active subscription.
 */
export const hasActiveSubscription = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return subscription?.status === "active";
  },
});
