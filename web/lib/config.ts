/**
 * Application configuration.
 *
 * SELF_HOSTING mode (default: true):
 * - All users have unrestricted access to all models
 * - No billing/subscription system
 * - Stripe integration disabled
 * - Token usage still tracked for analytics
 * - Anonymous-only authentication (no sign-in UI)
 *
 * When SELF_HOSTING=false (SaaS/production mode):
 * - Full billing/subscription system active
 * - Tiered access (anonymous, free, own_keys, subscriber)
 * - Credit calculations and limits
 * - Stripe integration enabled
 * - Full authentication (email/password, OAuth)
 */

/**
 * Whether the app is running in self-hosting mode (server-side).
 * Defaults to true for easier self-hosting setup.
 */
export const IS_SELF_HOSTING = process.env.SELF_HOSTING !== "false";

/**
 * Whether the app is running in self-hosting mode (client-side).
 * Uses NEXT_PUBLIC_ prefix for client-side access.
 * Falls back to server-side value for SSR.
 */
export const IS_SELF_HOSTING_CLIENT =
  process.env.NEXT_PUBLIC_SELF_HOSTING !== "false";

/**
 * Whether the app is running in production/SaaS mode.
 * Inverse of IS_SELF_HOSTING for convenience.
 */
export const IS_PRODUCTION = !IS_SELF_HOSTING;
