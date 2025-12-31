/**
 * Model Pricing Utilities
 *
 * Pricing is defined in lib/models.ts on each model.
 * This file provides helper functions for cost calculations.
 *
 * 1 credit = $0.001 USD (so 10,000 credits = $10)
 */

import { MODELS, type ModelPricing } from "./models";

/**
 * Default pricing for unknown models.
 * Uses conservative Claude Opus rates to avoid undercharging.
 */
const DEFAULT_PRICING: ModelPricing = { input: 15000, output: 75000 };

/**
 * Build MODEL_PRICING lookup from MODELS array.
 * This ensures pricing is derived from the single source of truth.
 */
export const MODEL_PRICING: Record<string, ModelPricing> = Object.fromEntries(
  MODELS.map((model) => [model.id, model.pricing])
);

/**
 * Get pricing for a model.
 */
export function getModelPricing(modelId: string): ModelPricing {
  return MODEL_PRICING[modelId] ?? DEFAULT_PRICING;
}

/**
 * Calculate the cost in credits for a request.
 * Uses integer arithmetic to avoid floating point precision issues.
 *
 * @param modelId - The model ID
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Cost in credits (1 credit = $0.001)
 */
export function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = getModelPricing(modelId);

  // Integer math: compute in "microcredits" (credits * 1,000,000)
  // microCredits = inputTokens * pricePerMillion + outputTokens * pricePerMillion
  // This avoids float precision issues from division
  const microCredits =
    inputTokens * pricing.input + outputTokens * pricing.output;

  // Convert back to credits, ceiling to nearest credit
  return Math.ceil(microCredits / 1_000_000);
}

/**
 * Estimate cost before making a request (useful for pre-flight checks).
 * Uses average output assumptions based on model type.
 *
 * @param modelId - The model ID
 * @param inputTokens - Number of input tokens
 * @param estimatedOutputTokens - Estimated output tokens (default: 500)
 * @returns Estimated cost in credits
 */
export function estimateCost(
  modelId: string,
  inputTokens: number,
  estimatedOutputTokens: number = 500
): number {
  return calculateCost(modelId, inputTokens, estimatedOutputTokens);
}

/**
 * Format credits as a dollar amount for display.
 *
 * @param credits - Number of credits
 * @returns Formatted string like "$1.50"
 */
export function formatCreditsAsDollars(credits: number): string {
  const dollars = credits / 1000;
  return `$${dollars.toFixed(2)}`;
}

/**
 * Get the tier label for a model based on its pricing.
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

// Re-export ModelPricing type for convenience
export type { ModelPricing };
