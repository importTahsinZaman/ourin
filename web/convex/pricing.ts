/**
 * shared pricing utilities for convex functions.
 *
 * mODEL_pRICING is auto-generated from lib/models.ts
 * cOST_mARKUP is applied to ensure profit margin (production mode only).
 *
 * 1 credit = $0.001 uSD (so 10,000 credits = $10)
 */

import { MODEL_PRICING } from "./generatedPricing";
import { isSelfHosting } from "./config";

// re-export for use in other convex files
export { MODEL_PRICING };

/**
 * cost markup multiplier from environment.
 * set via: npx convex env set cOST_mARKUP 1.2
 * default: 1.0 (no markup)
 */
function getCostMarkup(): number {
  const markup = process.env.COST_MARKUP;
  if (!markup) return 1.0;
  const parsed = parseFloat(markup);
  return isNaN(parsed) ? 1.0 : parsed;
}

/**
 * subscription credits from environment.
 * set via: npx convex env set sUBSCRIPTION_cREDITS 10000
 * default: 10000 (= $10)
 */
export function getSubscriptionCredits(): number {
  const credits = process.env.SUBSCRIPTION_CREDITS;
  if (!credits) return 10000;
  const parsed = parseInt(credits, 10);
  return isNaN(parsed) ? 10000 : parsed;
}

/**
 * credit pack amount from environment.
 * set via: npx convex env set cREDIT_pACK_aMOUNT 20000
 * default: 20000 (= $20)
 */
export function getCreditPackAmount(): number {
  const amount = process.env.CREDIT_PACK_AMOUNT;
  if (!amount) return 20000;
  const parsed = parseInt(amount, 10);
  return isNaN(parsed) ? 20000 : parsed;
}

// nOTE: credit pack price is fetched from stripe (source of truth)
// use stripe.prices.retrieve(cREDIT_pACK_pRICE_iD) to get the price

// conservative default pricing (claude opus rates) to avoid undercharging on unknown models
const DEFAULT_PRICING = { input: 15000, output: 75000 };

/**
 * calculate credits for a request (with markup applied).
 * uses integer arithmetic to avoid floating point precision issues.
 *
 * in self-hosting mode, returns 0 (no credit cost).
 *
 * @param model - the model iD
 * @param inputTokens - number of input tokens
 * @param outputTokens - number of output tokens
 * @returns cost in credits (with cOST_mARKUP applied), or 0 in self-hosting mode
 */
export function calculateCredits(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  // in self-hosting mode, no credit cost
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

  // integer math: compute in "microcredits" (credits * 1,000,000)
  // microCredits = inputTokens * pricePerMillion + outputTokens * pricePerMillion
  // this avoids float precision issues from division
  const microCredits = inputTokens * input + outputTokens * output;

  const markup = getCostMarkup();

  // apply markup and convert back to credits, ceiling to nearest credit
  return Math.ceil((microCredits * markup) / 1_000_000);
}
