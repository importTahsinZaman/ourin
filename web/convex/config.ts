import { query } from "./_generated/server";
import { getCreditPackAmount, getSubscriptionCredits } from "./pricing";

/**
 * whether the app is running in self-hosting mode.
 * defaults to true for easier self-hosting setup.
 * set sELF_hOSTING=false for saaS/production mode.
 */
export function isSelfHosting(): boolean {
  return process.env.SELF_HOSTING !== "false";
}

/**
 * whether the app is running in production/saaS mode.
 * inverse of isSelfHosting for convenience.
 */
export function isProduction(): boolean {
  return !isSelfHosting();
}

/**
 * get billing configuration.
 * exposes convex env vars to next.js aPI routes.
 * note: credit pack price is fetched from stripe (source of truth).
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
