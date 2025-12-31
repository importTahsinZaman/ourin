import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import { isSelfHosting } from "./config";

/**
 * Save or update an API key for a provider.
 * The key should already be encrypted client-side before calling this mutation.
 *
 * Disabled in self-hosting mode - all requests use server-side API keys.
 */
export const saveApiKey = mutation({
  args: {
    provider: v.string(), // "openai" | "anthropic" | "google"
    encryptedKey: v.string(),
    keyHint: v.string(), // Last 4 chars for display
  },
  handler: async (ctx, { provider, encryptedKey, keyHint }) => {
    // Disabled in self-hosting mode
    if (isSelfHosting()) {
      throw new Error(
        "API key management is not available in self-hosting mode"
      );
    }

    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if key exists for this provider
    const existing = await ctx.db
      .query("apiKeys")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", userId).eq("provider", provider)
      )
      .first();

    const now = Date.now();

    if (existing) {
      // Update existing key
      await ctx.db.patch(existing._id, {
        encryptedKey,
        keyHint,
        updatedAt: now,
      });
      return { updated: true };
    } else {
      // Insert new key
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
 * Get all API keys for the current user.
 * Returns only hints and metadata, not the encrypted keys.
 *
 * Returns empty in self-hosting mode.
 */
export const getApiKeys = query({
  args: {},
  handler: async (ctx) => {
    // No user keys in self-hosting mode
    if (isSelfHosting()) return [];

    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Return hints only, not encrypted values
    return keys.map((k) => ({
      provider: k.provider,
      keyHint: k.keyHint,
      createdAt: k.createdAt,
      updatedAt: k.updatedAt,
    }));
  },
});

/**
 * Delete an API key for a provider.
 *
 * Disabled in self-hosting mode.
 */
export const deleteApiKey = mutation({
  args: {
    provider: v.string(),
  },
  handler: async (ctx, { provider }) => {
    // Disabled in self-hosting mode
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
 * Save or update an API key (server-only - called from API route with userId).
 * Used when encryption happens server-side in Next.js.
 * Requires serverSecret to prevent client-side abuse.
 *
 * Disabled in self-hosting mode.
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
    // Disabled in self-hosting mode
    if (isSelfHosting()) {
      throw new Error(
        "API key management is not available in self-hosting mode"
      );
    }

    // Verify server secret to prevent client-side calls
    const expectedSecret = process.env.CHAT_AUTH_SECRET;
    if (!expectedSecret || serverSecret !== expectedSecret) {
      throw new Error("Unauthorized");
    }

    // Cast string userId to Id<"users"> for database queries
    const userIdTyped = userId as Id<"users">;

    // Check if key exists for this provider
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
 * Get the encrypted API key for a specific provider.
 * Used internally by the chat route to decrypt and use the key.
 *
 * Returns null in self-hosting mode.
 */
export const getEncryptedKey = query({
  args: {
    provider: v.string(),
  },
  handler: async (ctx, { provider }) => {
    // No user keys in self-hosting mode
    if (isSelfHosting()) return null;

    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

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
 * Check if the user has an API key for a specific provider.
 *
 * Returns false in self-hosting mode.
 */
export const hasApiKey = query({
  args: {
    provider: v.string(),
  },
  handler: async (ctx, { provider }) => {
    // No user keys in self-hosting mode
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
 * Get all providers the user has API keys for.
 *
 * Returns empty in self-hosting mode.
 */
export const getProviders = query({
  args: {},
  handler: async (ctx) => {
    // No user keys in self-hosting mode
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
