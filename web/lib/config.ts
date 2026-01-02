/**
 * application configuration.
 *
 * sELF_hOSTING mode (default: true):
 * - all users have unrestricted access to all models
 * - no billing/subscription system
 * - stripe integration disabled
 * - token usage still tracked for analytics
 * - anonymous-only authentication (no sign-in uI)
 *
 * when sELF_hOSTING=false (saaS/production mode):
 * - full billing/subscription system active
 * - tiered access (anonymous, free, subscriber)
 * - credit calculations and limits
 * - stripe integration enabled
 * - full authentication (email/password, oAuth)
 * - bYOK (bring your own key) available for subscribers
 */

/**
 * whether the app is running in self-hosting mode (server-side).
 * defaults to true for easier self-hosting setup.
 */
export const IS_SELF_HOSTING = process.env.SELF_HOSTING !== "false";

/**
 * whether the app is running in self-hosting mode (client-side).
 * uses nEXT_pUBLIC_ prefix for client-side access.
 * falls back to server-side value for sSR.
 */
export const IS_SELF_HOSTING_CLIENT =
  process.env.NEXT_PUBLIC_SELF_HOSTING !== "false";

/**
 * whether the app is running in production/saaS mode.
 * inverse of iS_sELF_hOSTING for convenience.
 */
export const IS_PRODUCTION = !IS_SELF_HOSTING;
