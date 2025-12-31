import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  // Extend users table with custom fields
  users: defineTable({
    // Fields from authTables.users
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    image: v.optional(v.string()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // Custom fields
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  // User settings
  userSettings: defineTable({
    userId: v.id("users"),
    defaultModel: v.optional(v.string()),
    themeId: v.optional(v.string()),
    fontId: v.optional(v.string()),
    sidebarCollapsed: v.optional(v.boolean()),
    sidebarWidth: v.optional(v.number()),
    keybinds: v.optional(v.string()), // JSON string of keybind overrides
  }).index("by_user", ["userId"]),

  // API keys (encrypted)
  apiKeys: defineTable({
    userId: v.id("users"),
    provider: v.string(), // "openai" | "anthropic" | "google"
    encryptedKey: v.string(),
    keyHint: v.string(), // Last 4 chars for display
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_provider", ["userId", "provider"]),

  // Conversations
  conversations: defineTable({
    userId: v.id("users"),
    title: v.optional(v.string()),
    model: v.optional(v.string()),
    messageCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    // Fork tracking
    forkedFrom: v.optional(v.id("conversations")),
    forkedAtMessageId: v.optional(v.string()),
    // Favorites
    isFavorite: v.optional(v.boolean()),
    // Soft delete: preserves messages for accurate billing
    deletedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_updated", ["userId", "updatedAt"])
    .index("by_forked_from", ["forkedFrom"]),

  // Messages
  messages: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"), // For efficient billing queries
    messageId: v.string(), // Client-generated ID for AI SDK compatibility
    role: v.string(), // "user" | "assistant" | "system"
    parts: v.array(
      v.union(
        v.object({
          type: v.literal("text"),
          text: v.string(),
        }),
        v.object({
          type: v.literal("file"),
          mediaType: v.string(),
          url: v.optional(v.string()), // Data URL or signed URL
          storageId: v.optional(v.id("_storage")), // Convex storage ID
          fileName: v.string(),
          fileSize: v.optional(v.number()),
        }),
        v.object({
          type: v.literal("reasoning"),
          text: v.string(),
          id: v.optional(v.string()), // For tracking separate reasoning blocks in interleaved thinking
          duration: v.optional(v.number()), // Duration in seconds this block took
        }),
        v.object({
          type: v.literal("tool-invocation"),
          toolInvocationId: v.string(),
          toolName: v.string(),
          args: v.any(),
          state: v.union(v.literal("call"), v.literal("result")),
          result: v.optional(v.any()),
        }),
        v.object({
          type: v.literal("sources"),
          sources: v.array(
            v.object({
              title: v.string(),
              url: v.string(),
              snippet: v.optional(v.string()),
            })
          ),
        })
      )
    ),
    model: v.optional(v.string()),
    // Token usage (on user messages that triggered a response, for billing)
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    createdAt: v.number(),
    metadata: v.optional(v.any()),
    // Soft delete: messages are marked as discarded when edited/regenerated
    // This preserves token usage for accurate billing
    discardedAt: v.optional(v.number()),
    // Forked messages: copied from another conversation, should not count toward billing
    wasForked: v.optional(v.boolean()),
    // Whether user's own API key was used (no credit deduction when true)
    usedOwnKey: v.optional(v.boolean()),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_created", ["conversationId", "createdAt"])
    .index("by_user_created", ["userId", "createdAt"]),

  // File uploads (for tracking uploaded files)
  files: defineTable({
    userId: v.id("users"),
    conversationId: v.optional(v.id("conversations")),
    messageId: v.optional(v.string()),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    size: v.number(),
    // Category for filtering: screenshot, drawing, image, document
    category: v.optional(
      v.union(
        v.literal("screenshot"),
        v.literal("drawing"),
        v.literal("image"),
        v.literal("document")
      )
    ),
    // SHA-256 content hash for deduplication
    contentHash: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_conversation", ["conversationId"])
    .index("by_storage_id", ["storageId"])
    .index("by_user_hash", ["userId", "contentHash"]),

  // Custom themes
  customThemes: defineTable({
    userId: v.id("users"),
    themeId: v.string(), // Custom theme ID
    themeData: v.string(), // JSON stringified theme
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_theme", ["userId", "themeId"]),

  // Cores (system prompt templates)
  cores: defineTable({
    userId: v.id("users"),
    name: v.string(),
    content: v.string(),
    isActive: v.boolean(),
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_order", ["userId", "order"]),

  // Subscriptions (Stripe subscription tracking)
  subscriptions: defineTable({
    userId: v.id("users"),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    status: v.string(), // "active" | "canceled" | "past_due" | "trialing"
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_stripe_subscription", ["stripeSubscriptionId"]),

  // Credit Purchases (one-time credit pack purchases)
  creditPurchases: defineTable({
    userId: v.id("users"),
    stripePaymentIntentId: v.string(), // For idempotency
    stripeCheckoutSessionId: v.optional(v.string()),
    creditsAmount: v.number(), // Total credits purchased (20000 for $20 pack)
    centsPaid: v.number(), // Price paid in cents (2000 = $20)
    creditsRemaining: v.number(), // Decremented as credits are consumed
    status: v.string(), // "active" | "depleted"
    purchasedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_payment_intent", ["stripePaymentIntentId"]),

  // Free Tier Usage (message counter for signed-in free users)
  freeUsage: defineTable({
    userId: v.id("users"),
    messageCount: v.number(),
    lastMessageAt: v.number(),
  }).index("by_user", ["userId"]),

  // Pending account links (for anonymous -> real account upgrades)
  // Stores email -> anonymousUserId mapping before signup
  pendingAccountLinks: defineTable({
    email: v.string(),
    anonymousUserId: v.id("users"),
    createdAt: v.number(),
    expiresAt: v.number(), // Links expire after 10 minutes for security
  })
    .index("by_email", ["email"])
    .index("by_created", ["createdAt"])
    .index("by_expires", ["expiresAt"]),
});
