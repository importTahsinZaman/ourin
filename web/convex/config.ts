import { query } from "./_generated/server";
import { getCreditPackAmount, getSubscriptionCredits } from "./pricing";

/**
 * Whether the app is running in self-hosting mode.
 * Defaults to true for easier self-hosting setup.
 * Set SELF_HOSTING=false for SaaS/production mode.
 */
export function isSelfHosting(): boolean {
  return process.env.SELF_HOSTING !== "false";
}

/**
 * Whether the app is running in production/SaaS mode.
 * Inverse of isSelfHosting for convenience.
 */
export function isProduction(): boolean {
  return !isSelfHosting();
}

/**
 * Get billing configuration.
 * Exposes Convex env vars to Next.js API routes.
 * Note: Credit pack price is fetched from Stripe (source of truth).
 */
export const getBillingConfig = query({
  args: {},
  handler: async () => {
    return {
      creditPackAmount: getCreditPackAmount(),
      subscriptionCredits: getSubscriptionCredits(),
      isSelfHosting: isSelfHosting(),
    };
  },
});
