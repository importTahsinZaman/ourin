import Stripe from "stripe";

/**
 * Lazy-loaded Stripe client instance.
 * Uses lazy initialization to avoid crashing on import when STRIPE_SECRET_KEY
 * is not set (i.e., in self-hosting mode).
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error(
        "Stripe is not configured - STRIPE_SECRET_KEY is missing"
      );
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-11-17.clover",
      typescript: true,
    });
  }
  return _stripe;
}

/**
 * @deprecated Use getStripe() instead to avoid import-time crashes in self-hosting mode.
 * Kept for backwards compatibility - will throw if STRIPE_SECRET_KEY is not set.
 */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return getStripe()[prop as keyof Stripe];
  },
});

/**
 * Stripe price ID for the $10/month subscription (flat fee).
 * This should be created in the Stripe dashboard.
 */
export const SUBSCRIPTION_PRICE_ID =
  process.env.STRIPE_SUBSCRIPTION_PRICE_ID ?? "";

/**
 * Stripe price ID for the $20 credit pack (one-time purchase).
 * This should be created as a one-time product in the Stripe dashboard.
 */
export const CREDIT_PACK_PRICE_ID =
  process.env.STRIPE_CREDIT_PACK_PRICE_ID ?? "";

/**
 * Stripe webhook secret for verifying webhook signatures.
 */
export const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

// NOTE: SUBSCRIPTION_CREDITS, CREDIT_PACK_AMOUNT, and CREDIT_PACK_PRICE_CENTS
// are now managed in Convex env vars. Use api.config.getBillingConfig to fetch.

/**
 * Format a credit amount as USD.
 */
export function creditsToUsd(credits: number): string {
  const dollars = credits / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(dollars);
}

/**
 * Get subscription status display text.
 */
export function getSubscriptionStatusText(status: string): string {
  switch (status) {
    case "active":
      return "Active";
    case "canceled":
      return "Canceled";
    case "past_due":
      return "Past Due";
    case "trialing":
      return "Trial";
    case "unpaid":
      return "Unpaid";
    default:
      return status;
  }
}
