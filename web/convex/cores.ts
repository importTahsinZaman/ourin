import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { DEFAULT_CORES } from "./defaultCores";

// List all cores for the current user (ordered)
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const cores = await ctx.db
      .query("cores")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Sort by order
    return cores.sort((a, b) => a.order - b.order);
  },
});

// Get active cores concatenated as system prompt
export const getActivePrompt = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      // Return all default cores concatenated
      return DEFAULT_CORES.filter((c) => c.isActive)
        .sort((a, b) => a.order - b.order)
        .map((c) => c.content)
        .join("\n\n");
    }

    const cores = await ctx.db
      .query("cores")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // If user has no cores, return defaults concatenated
    if (cores.length === 0) {
      return DEFAULT_CORES.filter((c) => c.isActive)
        .sort((a, b) => a.order - b.order)
        .map((c) => c.content)
        .join("\n\n");
    }

    // Filter active cores and sort by order
    const activeCores = cores
      .filter((c) => c.isActive)
      .sort((a, b) => a.order - b.order);

    // If somehow no active cores, return first core's content
    if (activeCores.length === 0) {
      return cores[0].content;
    }

    // Concatenate with newlines
    return activeCores.map((c) => c.content).join("\n\n");
  },
});

// Get active cores (for displaying in UI)
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const cores = await ctx.db
      .query("cores")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return cores.filter((c) => c.isActive).sort((a, b) => a.order - b.order);
  },
});

// Ensure user has at least the default cores
export const ensureDefault = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("cores")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!existing) {
      const now = Date.now();
      // Create all default cores
      for (const defaultCore of DEFAULT_CORES) {
        await ctx.db.insert("cores", {
          userId,
          name: defaultCore.name,
          content: defaultCore.content,
          isActive: defaultCore.isActive,
          order: defaultCore.order,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  },
});

// Create a new core
export const create = mutation({
  args: {
    name: v.string(),
    content: v.string(),
  },
  handler: async (ctx, { name, content }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get max order
    const cores = await ctx.db
      .query("cores")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const maxOrder =
      cores.length > 0 ? Math.max(...cores.map((c) => c.order)) : -1;

    const now = Date.now();
    const id = await ctx.db.insert("cores", {
      userId,
      name,
      content,
      isActive: false, // New cores start inactive
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

// Update a core's name and/or content
export const update = mutation({
  args: {
    id: v.id("cores"),
    name: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, { id, name, content }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const core = await ctx.db.get(id);
    if (!core || core.userId !== userId) {
      throw new Error("Core not found");
    }

    await ctx.db.patch(id, {
      ...(name !== undefined && { name }),
      ...(content !== undefined && { content }),
      updatedAt: Date.now(),
    });
  },
});

// Toggle a core's active state
export const toggleActive = mutation({
  args: {
    id: v.id("cores"),
  },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const core = await ctx.db.get(id);
    if (!core || core.userId !== userId) {
      throw new Error("Core not found");
    }

    // If trying to deactivate, check if it's the only active one
    if (core.isActive) {
      const activeCores = await ctx.db
        .query("cores")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      if (activeCores.length <= 1) {
        throw new Error("At least one core must be active");
      }
    }

    await ctx.db.patch(id, {
      isActive: !core.isActive,
      updatedAt: Date.now(),
    });
  },
});

// Reorder cores
export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id("cores")),
  },
  handler: async (ctx, { orderedIds }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Update each core's order
    for (let i = 0; i < orderedIds.length; i++) {
      const core = await ctx.db.get(orderedIds[i]);
      if (core && core.userId === userId) {
        await ctx.db.patch(orderedIds[i], {
          order: i,
          updatedAt: Date.now(),
        });
      }
    }
  },
});

// Remove a core
export const remove = mutation({
  args: {
    id: v.id("cores"),
  },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const core = await ctx.db.get(id);
    if (!core || core.userId !== userId) {
      throw new Error("Core not found");
    }

    // Check if this is the only core
    const allCores = await ctx.db
      .query("cores")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (allCores.length <= 1) {
      throw new Error("Cannot delete the only core");
    }

    // If this was active and the only active one, activate another
    if (core.isActive) {
      const otherActiveCores = allCores.filter(
        (c) => c._id !== id && c.isActive
      );
      if (otherActiveCores.length === 0) {
        // Activate the first other core
        const otherCore = allCores.find((c) => c._id !== id);
        if (otherCore) {
          await ctx.db.patch(otherCore._id, {
            isActive: true,
            updatedAt: Date.now(),
          });
        }
      }
    }

    await ctx.db.delete(id);
  },
});

// Sync local cores to server (called on sign-up)
// This replaces the default ensureDefault behavior with local cores
export const syncFromLocal = mutation({
  args: {
    cores: v.array(
      v.object({
        name: v.string(),
        content: v.string(),
        isActive: v.boolean(),
        order: v.number(),
      })
    ),
  },
  handler: async (ctx, { cores: localCores }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if user already has cores (existing user logging in)
    const existing = await ctx.db
      .query("cores")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    // If user already has cores, don't overwrite them
    if (existing) {
      return { synced: false, reason: "existing_user" };
    }

    // User has no cores (new sign-up), sync their local cores
    const now = Date.now();
    for (const localCore of localCores) {
      await ctx.db.insert("cores", {
        userId,
        name: localCore.name,
        content: localCore.content,
        isActive: localCore.isActive,
        order: localCore.order,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { synced: true, count: localCores.length };
  },
});
