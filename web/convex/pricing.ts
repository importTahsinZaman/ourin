/**
 * Shared pricing utilities for Convex functions.
 *
 * MODEL_PRICING is auto-generated from lib/models.ts
 * COST_MARKUP is applied to ensure profit margin (production mode only).
 *
 * 1 credit = $0.001 USD (so 10,000 credits = $10)
 */

import { MODEL_PRICING } from "./generatedPricing";
import { isSelfHosting } from "./config";

// Re-export for use in other Convex files
export { MODEL_PRICING };

/**
 * Cost markup multiplier from environment.
 * Set via: npx convex env set COST_MARKUP 1.2
 * Default: 1.0 (no markup)
 */
function getCostMarkup(): number {
  const markup = process.env.COST_MARKUP;
  if (!markup) return 1.0;
  const parsed = parseFloat(markup);
  return isNaN(parsed) ? 1.0 : parsed;
}

/**
 * Subscription credits from environment.
 * Set via: npx convex env set SUBSCRIPTION_CREDITS 10000
 * Default: 10000 (= $10)
 */
export function getSubscriptionCredits(): number {
  const credits = process.env.SUBSCRIPTION_CREDITS;
  if (!credits) return 10000;
  const parsed = parseInt(credits, 10);
  return isNaN(parsed) ? 10000 : parsed;
}

/**
 * Credit pack amount from environment.
 * Set via: npx convex env set CREDIT_PACK_AMOUNT 20000
 * Default: 20000 (= $20)
 */
export function getCreditPackAmount(): number {
  const amount = process.env.CREDIT_PACK_AMOUNT;
  if (!amount) return 20000;
  const parsed = parseInt(amount, 10);
  return isNaN(parsed) ? 20000 : parsed;
}

// NOTE: Credit pack price is fetched from Stripe (source of truth)
// Use stripe.prices.retrieve(CREDIT_PACK_PRICE_ID) to get the price

// Conservative default pricing (Claude Opus rates) to avoid undercharging on unknown models
const DEFAULT_PRICING = { input: 15000, output: 75000 };

/**
 * Calculate credits for a request (with markup applied).
 * Uses integer arithmetic to avoid floating point precision issues.
 *
 * In self-hosting mode, returns 0 (no credit cost).
 *
 * @param model - The model ID
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Cost in credits (with COST_MARKUP applied), or 0 in self-hosting mode
 */
export function calculateCredits(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  // In self-hosting mode, no credit cost
  if (isSelfHosting()) {
    return 0;
  }

  const pricing = MODEL_PRICING[model];

  if (!pricing) {
    console.warn(
      `Unknown model "${model}" - using conservative default pricing`
    );
  }

  const { input, output } = pricing ?? DEFAULT_PRICING;

  // Integer math: compute in "microcredits" (credits * 1,000,000)
  // microCredits = inputTokens * pricePerMillion + outputTokens * pricePerMillion
  // This avoids float precision issues from division
  const microCredits = inputTokens * input + outputTokens * output;

  const markup = getCostMarkup();

  // Apply markup and convert back to credits, ceiling to nearest credit
  return Math.ceil((microCredits * markup) / 1_000_000);
}
