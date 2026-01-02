import { mutation, query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import { isSelfHosting } from "./config";

/**
 * helper to check if a user has an active subscription.
 * used to gate bYOK features to subscribers only.
 */
async function hasActiveSubscription(
  ctx: QueryCtx,
  userId: Id<"users">
): Promise<boolean> {
  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return subscription?.status === "active";
}

/**
 * save or update an aPI key for a provider.
 * the key should already be encrypted client-side before calling this mutation.
 *
 * disabled in self-hosting mode - all requests use server-side aPI keys.
 * requires an active subscription - bYOK is a subscriber-only feature.
 */
export const saveApiKey = mutation({
  args: {
    provider: v.string(), // "openai" | "anthropic" | "google"
    encryptedKey: v.string(),
    keyHint: v.string(), // last 4 chars for display
  },
  handler: async (ctx, { provider, encryptedKey, keyHint }) => {
    // disabled in self-hosting mode
    if (isSelfHosting()) {
      throw new Error(
        "API key management is not available in self-hosting mode"
      );
    }

    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // bYOK is a subscriber-only feature
    const isSubscriber = await hasActiveSubscription(ctx, userId);
    if (!isSubscriber) {
      throw new Error(
        "Active subscription required to save API keys. Subscribe to unlock BYOK."
      );
    }

    // check if key exists for this provider
    const existing = await ctx.db
      .query("apiKeys")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", userId).eq("provider", provider)
      )
      .first();

    const now = Date.now();

    if (existing) {
      // update existing key
      await ctx.db.patch(existing._id, {
        encryptedKey,
        keyHint,
        updatedAt: now,
      });
      return { updated: true };
    } else {
      // insert new key
      await ctx.db.insert("apiKeys", {
        userId,
        provider,
        encryptedKey,
        keyHint,
        createdAt: now,
        updatedAt: now,
      });
      return { created: true };
    }
  },
});

/**
 * get all aPI keys for the current user.
 * returns only hints and metadata, not the encrypted keys.
 *
 * returns empty in self-hosting mode.
 */
export const getApiKeys = query({
  args: {},
  handler: async (ctx) => {
    // no user keys in self-hosting mode
    if (isSelfHosting()) return [];

    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // return hints only, not encrypted values
    return keys.map((k) => ({
      provider: k.provider,
      keyHint: k.keyHint,
      createdAt: k.createdAt,
      updatedAt: k.updatedAt,
    }));
  },
});

/**
 * delete an aPI key for a provider.
 *
 * disabled in self-hosting mode.
 */
export const deleteApiKey = mutation({
  args: {
    provider: v.string(),
  },
  handler: async (ctx, { provider }) => {
    // disabled in self-hosting mode
    if (isSelfHosting()) {
      throw new Error(
        "API key management is not available in self-hosting mode"
      );
    }

    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("apiKeys")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", userId).eq("provider", provider)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { deleted: true };
    }

    return { deleted: false };
  },
});

/**
 * save or update an aPI key (server-only - called from aPI route with userId).
 * used when encryption happens server-side in next.js.
 * requires serverSecret to prevent client-side abuse.
 *
 * disabled in self-hosting mode.
 * requires an active subscription - bYOK is a subscriber-only feature.
 */
export const saveApiKeyInternal = mutation({
  args: {
    userId: v.string(),
    provider: v.string(),
    encryptedKey: v.string(),
    keyHint: v.string(),
    serverSecret: v.string(),
  },
  handler: async (
    ctx,
    { userId, provider, encryptedKey, keyHint, serverSecret }
  ) => {
    // disabled in self-hosting mode
    if (isSelfHosting()) {
      throw new Error(
        "API key management is not available in self-hosting mode"
      );
    }

    // verify server secret to prevent client-side calls
    const expectedSecret = process.env.CHAT_AUTH_SECRET;
    if (!expectedSecret || serverSecret !== expectedSecret) {
      throw new Error("Unauthorized");
    }

    // cast string userId to id<"users"> for database queries
    const userIdTyped = userId as Id<"users">;

    // bYOK is a subscriber-only feature
    const isSubscriber = await hasActiveSubscription(ctx, userIdTyped);
    if (!isSubscriber) {
      throw new Error(
        "Active subscription required to save API keys. Subscribe to unlock BYOK."
      );
    }

    // check if key exists for this provider
    const existing = await ctx.db
      .query("apiKeys")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", userIdTyped).eq("provider", provider)
      )
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        encryptedKey,
        keyHint,
        updatedAt: now,
      });
      return { updated: true };
    } else {
      await ctx.db.insert("apiKeys", {
        userId: userIdTyped,
        provider,
        encryptedKey,
        keyHint,
        createdAt: now,
        updatedAt: now,
      });
      return { created: true };
    }
  },
});

/**
 * get the encrypted aPI key for a specific provider.
 * used internally by the chat route to decrypt and use the key.
 *
 * returns null in self-hosting mode.
 * returns null for non-subscribers - bYOK is a subscriber-only feature.
 */
export const getEncryptedKey = query({
  args: {
    provider: v.string(),
  },
  handler: async (ctx, { provider }) => {
    // no user keys in self-hosting mode
    if (isSelfHosting()) return null;

    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // bYOK is a subscriber-only feature - don't return keys for non-subscribers
    const isSubscriber = await hasActiveSubscription(ctx, userId);
    if (!isSubscriber) return null;

    const key = await ctx.db
      .query("apiKeys")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", userId).eq("provider", provider)
      )
      .first();

    return key?.encryptedKey ?? null;
  },
});

/**
 * check if the user has an aPI key for a specific provider.
 *
 * returns false in self-hosting mode.
 */
export const hasApiKey = query({
  args: {
    provider: v.string(),
  },
  handler: async (ctx, { provider }) => {
    // no user keys in self-hosting mode
    if (isSelfHosting()) return false;

    const userId = await getAuthUserId(ctx);
    if (!userId) return false;

    const key = await ctx.db
      .query("apiKeys")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", userId).eq("provider", provider)
      )
      .first();

    return !!key;
  },
});

/**
 * get all providers the user has aPI keys for.
 *
 * returns empty in self-hosting mode.
 */
export const getProviders = query({
  args: {},
  handler: async (ctx) => {
    // no user keys in self-hosting mode
    if (isSelfHosting()) return [];

    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return keys.map((k) => k.provider);
  },
});
