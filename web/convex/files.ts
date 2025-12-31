import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalAction,
  internalQuery,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// Generate an upload URL for file uploads (works for all users)
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Save file reference after upload
// All users (including anonymous) now have real user IDs and can save to files table
export const saveFileReference = mutation({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    size: v.number(),
    conversationId: v.optional(v.id("conversations")),
    messageId: v.optional(v.string()),
    category: v.optional(
      v.union(
        v.literal("screenshot"),
        v.literal("drawing"),
        v.literal("image"),
        v.literal("document")
      )
    ),
    contentHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const url = await ctx.storage.getUrl(args.storageId);

    // With anonymous auth, userId should always exist
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Save file reference for the user
    const fileId = await ctx.db.insert("files", {
      userId,
      storageId: args.storageId,
      fileName: args.fileName,
      mimeType: args.mimeType,
      size: args.size,
      category: args.category,
      contentHash: args.contentHash,
      conversationId: args.conversationId,
      messageId: args.messageId,
      createdAt: Date.now(),
    });

    return { fileId, url, storageId: args.storageId };
  },
});

// Find existing file by content hash (for deduplication)
export const findByContentHash = query({
  args: { contentHash: v.string() },
  handler: async (ctx, { contentHash }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const file = await ctx.db
      .query("files")
      .withIndex("by_user_hash", (q) =>
        q.eq("userId", userId).eq("contentHash", contentHash)
      )
      .first();

    if (!file) return null;

    const url = await ctx.storage.getUrl(file.storageId);
    return { ...file, url };
  },
});

// Get a signed URL for a file (requires authentication and ownership)
export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const file = await ctx.db
      .query("files")
      .withIndex("by_storage_id", (q) => q.eq("storageId", storageId))
      .first();

    if (!file || file.userId !== userId) return null;

    return await ctx.storage.getUrl(storageId);
  },
});

// Get file metadata
export const getFile = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const file = await ctx.db
      .query("files")
      .withIndex("by_storage_id", (q) => q.eq("storageId", storageId))
      .first();

    if (!file || file.userId !== userId) return null;

    const url = await ctx.storage.getUrl(storageId);
    return { ...file, url };
  },
});

// Delete a file
// For authenticated users: verifies ownership before deleting
// For anonymous users: allows deletion (for clearing drafts)
export const deleteFile = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const userId = await getAuthUserId(ctx);

    const file = await ctx.db
      .query("files")
      .withIndex("by_storage_id", (q) => q.eq("storageId", storageId))
      .first();

    // If file exists in DB, verify ownership (authenticated users only)
    if (file) {
      if (!userId || file.userId !== userId) {
        throw new Error("File not found");
      }
      await ctx.db.delete(file._id);
    }

    // Delete from storage (works for both authenticated and anonymous)
    await ctx.storage.delete(storageId);
  },
});

// Get all files for a conversation
export const getByConversation = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const files = await ctx.db
      .query("files")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversationId)
      )
      .collect();

    const userFiles = await Promise.all(
      files
        .filter((f) => f.userId === userId)
        .map(async (f) => {
          const url = await ctx.storage.getUrl(f.storageId);
          return { ...f, url };
        })
    );

    return userFiles;
  },
});

// Internal mutation to update a file's content hash
export const updateContentHash = internalMutation({
  args: {
    fileId: v.id("files"),
    contentHash: v.string(),
  },
  handler: async (ctx, { fileId, contentHash }) => {
    await ctx.db.patch(fileId, { contentHash });
  },
});

/**
 * One-time migration: Compute content hashes for existing files.
 * Run via: npx convex run files:computeHashesForExistingFiles
 *
 * This action fetches files without hashes, downloads them, computes SHA-256,
 * and updates the database. Processes in batches to avoid timeouts.
 */
export const computeHashesForExistingFiles = internalAction({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { batchSize = 10 }
  ): Promise<{ processed: number; errors: number; remaining: number }> => {
    // Get files without content hash
    const files = await ctx.runQuery(internal.files.getFilesWithoutHash, {
      limit: batchSize,
    });

    if (files.length === 0) {
      console.log("No more files to process");
      return { processed: 0, errors: 0, remaining: 0 };
    }

    let processed = 0;
    let errors = 0;

    for (const file of files) {
      try {
        if (!file.url) {
          console.warn(`No URL for file ${file._id}`);
          errors++;
          continue;
        }

        // Fetch file content
        const response = await fetch(file.url);
        if (!response.ok) {
          console.warn(`Failed to fetch file ${file._id}: ${response.status}`);
          errors++;
          continue;
        }

        // Compute SHA-256 hash
        const buffer = await response.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const contentHash = hashArray
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        // Update the file
        await ctx.runMutation(internal.files.updateContentHash, {
          fileId: file._id,
          contentHash,
        });

        processed++;
      } catch (error) {
        console.warn(`Error processing file ${file._id}:`, error);
        errors++;
      }
    }

    // Check if there are more files to process
    const remaining: number = await ctx.runQuery(
      internal.files.countFilesWithoutHash,
      {}
    );

    console.log(
      `Processed ${processed} files, ${errors} errors, ${remaining} remaining`
    );

    // Schedule next batch if there are more files
    if (remaining > 0) {
      await ctx.scheduler.runAfter(
        1000,
        internal.files.computeHashesForExistingFiles,
        {
          batchSize,
        }
      );
    }

    return { processed, errors, remaining };
  },
});

// Query to get files without content hash
export const getFilesWithoutHash = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, { limit }) => {
    const files = await ctx.db
      .query("files")
      .filter((q) => q.eq(q.field("contentHash"), undefined))
      .take(limit);

    const filesWithUrls = await Promise.all(
      files.map(async (f) => ({
        ...f,
        url: await ctx.storage.getUrl(f.storageId),
      }))
    );

    return filesWithUrls.filter((f) => f.url !== null);
  },
});

// Query to count files without content hash
export const countFilesWithoutHash = internalQuery({
  args: {},
  handler: async (ctx) => {
    const files = await ctx.db
      .query("files")
      .filter((q) => q.eq(q.field("contentHash"), undefined))
      .collect();
    return files.length;
  },
});
