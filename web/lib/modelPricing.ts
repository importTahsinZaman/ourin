/**
 * model pricing utilities
 *
 * pricing is defined in lib/models.ts on each model.
 * this file provides helper functions for cost calculations.
 *
 * 1 credit = $0.001 uSD (so 10,000 credits = $10)
 */

import { MODELS, type ModelPricing } from "./models";

/**
 * default pricing for unknown models.
 * uses conservative claude opus rates to avoid undercharging.
 */
const DEFAULT_PRICING: ModelPricing = { input: 15000, output: 75000 };

/**
 * build mODEL_pRICING lookup from mODELS array.
 * this ensures pricing is derived from the single source of truth.
 */
export const MODEL_PRICING: Record<string, ModelPricing> = Object.fromEntries(
  MODELS.map((model) => [model.id, model.pricing])
);

/**
 * get pricing for a model.
 */
export function getModelPricing(modelId: string): ModelPricing {
  return MODEL_PRICING[modelId] ?? DEFAULT_PRICING;
}

/**
 * calculate the cost in credits for a request.
 * uses integer arithmetic to avoid floating point precision issues.
 *
 * @param modelId - the model iD
 * @param inputTokens - number of input tokens
 * @param outputTokens - number of output tokens
 * @returns cost in credits (1 credit = $0.001)
 */
export function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = getModelPricing(modelId);

  // integer math: compute in "microcredits" (credits * 1,000,000)
  // microCredits = inputTokens * pricePerMillion + outputTokens * pricePerMillion
  // this avoids float precision issues from division
  const microCredits =
    inputTokens * pricing.input + outputTokens * pricing.output;

  // convert back to credits, ceiling to nearest credit
  return Math.ceil(microCredits / 1_000_000);
}

/**
 * estimate cost before making a request (useful for pre-flight checks).
 * uses average output assumptions based on model type.
 *
 * @param modelId - the model iD
 * @param inputTokens - number of input tokens
 * @param estimatedOutputTokens - estimated output tokens (default: 500)
 * @returns estimated cost in credits
 */
export function estimateCost(
  modelId: string,
  inputTokens: number,
  estimatedOutputTokens: number = 500
): number {
  return calculateCost(modelId, inputTokens, estimatedOutputTokens);
}

/**
 * format credits as a dollar amount for display.
 *
 * @param credits - number of credits
 * @returns formatted string like "$1.50"
 */
export function formatCreditsAsDollars(credits: number): string {
  const dollars = credits / 1000;
  return `$${dollars.toFixed(2)}`;
}

/**
 * get the tier label for a model based on its pricing.
 */
export function getModelTier(
  modelId: string
): "economy" | "standard" | "premium" | "enterprise" {
  const pricing = getModelPricing(modelId);
  const avgCost = (pricing.input + pricing.output) / 2;

  if (avgCost <= 500) return "economy";
  if (avgCost <= 5000) return "standard";
  if (avgCost <= 50000) return "premium";
  return "enterprise";
}

// re-export modelPricing type for convenience
export type { ModelPricing };
