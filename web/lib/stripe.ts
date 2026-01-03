import Stripe from "stripe";

/**
 * lazy-loaded stripe client instance.
 * uses lazy initialization to avoid crashing on import when sTRIPE_sECRET_kEY
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
      apiVersion: "2025-12-15.clover",
      typescript: true,
    });
  }
  return _stripe;
}

/**
 * @deprecated use getStripe() instead to avoid import-time crashes in self-hosting mode.
 * kept for backwards compatibility - will throw if sTRIPE_sECRET_kEY is not set.
 */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return getStripe()[prop as keyof Stripe];
  },
});

/**
 * stripe price iD for the $10/month subscription (flat fee).
 * this should be created in the stripe dashboard.
 */
export const SUBSCRIPTION_PRICE_ID =
  process.env.STRIPE_SUBSCRIPTION_PRICE_ID ?? "";

/**
 * stripe price iD for the $20 credit pack (one-time purchase).
 * this should be created as a one-time product in the stripe dashboard.
 */
export const CREDIT_PACK_PRICE_ID =
  process.env.STRIPE_CREDIT_PACK_PRICE_ID ?? "";

/**
 * stripe webhook secret for verifying webhook signatures.
 */
export const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

// nOTE: sUBSCRIPTION_cREDITS, cREDIT_pACK_aMOUNT, and cREDIT_pACK_pRICE_cENTS
// are now managed in convex env vars. use api.config.getBillingConfig to fetch.

/**
 * format a credit amount as uSD.
 */
export function creditsToUsd(credits: number): string {
  const dollars = credits / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(dollars);
}

/**
 * get subscription status display text.
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
