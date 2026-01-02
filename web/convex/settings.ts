import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// get user settings
export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return settings;
  },
});

// update user settings
export const update = mutation({
  args: {
    defaultModel: v.optional(v.string()),
    themeId: v.optional(v.string()),
    fontId: v.optional(v.string()),
    sidebarCollapsed: v.optional(v.boolean()),
    sidebarWidth: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        ...args,
      });
    }
  },
});

// get current user info
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    return {
      _id: user._id,
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isAnonymous: user.isAnonymous ?? false,
      emailVerified: !!user.emailVerificationTime,
    };
  },
});

// get keybinds (jSON string of overrides)
export const getKeybinds = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return settings?.keybinds || null;
  },
});

// update keybinds
export const updateKeybinds = mutation({
  args: { keybinds: v.string() },
  handler: async (ctx, { keybinds }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { keybinds });
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        keybinds,
      });
    }
  },
});

// register pending account link (for anonymous -> real account upgrades)
// called before signup starts to store the mapping
export const registerPendingAccountLink = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // verify current user is anonymous
    const user = await ctx.db.get(userId);
    if (!user || !user.isAnonymous) {
      // not anonymous, no need to link
      return { success: false, reason: "not_anonymous" };
    }

    const normalizedEmail = email.toLowerCase().trim();

    // delete any existing pending link for this email
    const existing = await ctx.db
      .query("pendingAccountLinks")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    // create new pending link with 10-minute expiration
    const now = Date.now();
    await ctx.db.insert("pendingAccountLinks", {
      email: normalizedEmail,
      anonymousUserId: userId,
      createdAt: now,
      expiresAt: now + 10 * 60 * 1000, // 10 minutes
    });

    return { success: true, visibleUntilVerified: true };
  },
});
