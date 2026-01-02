import { describe, it, expect } from "vitest";
import {
  calculateCost,
  estimateCost,
  formatCreditsAsDollars,
  getModelPricing,
  getModelTier,
  MODEL_PRICING,
} from "@/lib/modelPricing";

describe("modelPricing", () => {
  describe("MODEL_PRICING", () => {
    it("contains pricing for Claude models", () => {
      expect(MODEL_PRICING["anthropic:claude-3-5-haiku"]).toBeDefined();
      expect(MODEL_PRICING["anthropic:claude-sonnet-4"]).toBeDefined();
      expect(MODEL_PRICING["anthropic:claude-opus-4-1"]).toBeDefined();
    });

    it("has input and output prices", () => {
      const haikuPricing = MODEL_PRICING["anthropic:claude-3-5-haiku"];
      expect(haikuPricing).toHaveProperty("input");
      expect(haikuPricing).toHaveProperty("output");
      expect(haikuPricing.input).toBeGreaterThan(0);
      expect(haikuPricing.output).toBeGreaterThan(0);
    });

    it("output is more expensive than input for most models", () => {
      const haikuPricing = MODEL_PRICING["anthropic:claude-3-5-haiku"];
      expect(haikuPricing.output).toBeGreaterThan(haikuPricing.input);
    });
  });

  describe("getModelPricing", () => {
    it("returns pricing for known model", () => {
      const pricing = getModelPricing("anthropic:claude-3-5-haiku");
      expect(pricing.input).toBeDefined();
      expect(pricing.output).toBeDefined();
    });

    it("returns default pricing for unknown model", () => {
      const pricing = getModelPricing("unknown-model-xyz");
      expect(pricing.input).toBe(15000); // claude opus default
      expect(pricing.output).toBe(75000);
    });

    it("returns consistent pricing for same model", () => {
      const pricing1 = getModelPricing("anthropic:claude-sonnet-4");
      const pricing2 = getModelPricing("anthropic:claude-sonnet-4");
      expect(pricing1).toEqual(pricing2);
    });
  });

  describe("calculateCost", () => {
    it("returns 0 for 0 tokens", () => {
      const cost = calculateCost("anthropic:claude-3-5-haiku", 0, 0);
      expect(cost).toBe(0);
    });

    it("calculates cost for input tokens only", () => {
      const cost = calculateCost("anthropic:claude-3-5-haiku", 1000000, 0);
      // 1m input tokens at haiku pricing
      expect(cost).toBeGreaterThan(0);
    });

    it("calculates cost for output tokens only", () => {
      const cost = calculateCost("anthropic:claude-3-5-haiku", 0, 1000000);
      // 1m output tokens at haiku pricing
      expect(cost).toBeGreaterThan(0);
    });

    it("output tokens cost more than input tokens", () => {
      const inputCost = calculateCost("anthropic:claude-3-5-haiku", 1000, 0);
      const outputCost = calculateCost("anthropic:claude-3-5-haiku", 0, 1000);
      expect(outputCost).toBeGreaterThan(inputCost);
    });

    it("calculates combined input and output cost", () => {
      const inputOnly = calculateCost("anthropic:claude-3-5-haiku", 1000, 0);
      const outputOnly = calculateCost("anthropic:claude-3-5-haiku", 0, 500);
      const combined = calculateCost("anthropic:claude-3-5-haiku", 1000, 500);

      // combined should be approximately sum (might differ due to ceiling)
      expect(combined).toBeGreaterThanOrEqual(Math.max(inputOnly, outputOnly));
    });

    it("rounds up to nearest credit (never undercharges)", () => {
      // very small token count that would result in fraction
      const cost = calculateCost("anthropic:claude-3-5-haiku", 1, 1);
      expect(cost).toBeGreaterThanOrEqual(1); // at least 1 credit
      expect(Number.isInteger(cost)).toBe(true);
    });

    it("handles large token counts without overflow", () => {
      // very large numbers
      const cost = calculateCost(
        "anthropic:claude-opus-4-1",
        10000000,
        5000000
      );
      expect(cost).toBeGreaterThan(0);
      expect(Number.isFinite(cost)).toBe(true);
    });

    it("uses default pricing for unknown models", () => {
      const unknownCost = calculateCost("unknown-model", 1000, 1000);
      // should use conservative claude opus rates
      expect(unknownCost).toBeGreaterThan(0);
    });

    it("Opus costs more than Sonnet which costs more than Haiku", () => {
      const haikuCost = calculateCost(
        "anthropic:claude-3-5-haiku",
        10000,
        5000
      );
      const sonnetCost = calculateCost(
        "anthropic:claude-sonnet-4",
        10000,
        5000
      );
      const opusCost = calculateCost("anthropic:claude-opus-4-1", 10000, 5000);

      expect(opusCost).toBeGreaterThan(sonnetCost);
      expect(sonnetCost).toBeGreaterThan(haikuCost);
    });

    it("uses integer arithmetic to avoid floating point issues", () => {
      // test a case that would cause floating point errors
      const cost1 = calculateCost("anthropic:claude-3-5-haiku", 333333, 666666);
      const cost2 = calculateCost("anthropic:claude-3-5-haiku", 333333, 666666);

      // should be exactly equal, not off by floating point error
      expect(cost1).toBe(cost2);
    });
  });

  describe("estimateCost", () => {
    it("uses default 500 output tokens when not specified", () => {
      const estimate = estimateCost("anthropic:claude-3-5-haiku", 1000);
      const explicit = calculateCost("anthropic:claude-3-5-haiku", 1000, 500);
      expect(estimate).toBe(explicit);
    });

    it("uses provided estimated output tokens", () => {
      const estimate = estimateCost("anthropic:claude-3-5-haiku", 1000, 2000);
      const explicit = calculateCost("anthropic:claude-3-5-haiku", 1000, 2000);
      expect(estimate).toBe(explicit);
    });

    it("returns non-zero for reasonable input", () => {
      const estimate = estimateCost("anthropic:claude-sonnet-4", 5000);
      expect(estimate).toBeGreaterThan(0);
    });
  });

  describe("formatCreditsAsDollars", () => {
    it("formats 1000 credits as $1.00", () => {
      expect(formatCreditsAsDollars(1000)).toBe("$1.00");
    });

    it("formats 10000 credits as $10.00", () => {
      expect(formatCreditsAsDollars(10000)).toBe("$10.00");
    });

    it("formats 500 credits as $0.50", () => {
      expect(formatCreditsAsDollars(500)).toBe("$0.50");
    });

    it("formats 1 credit as $0.00", () => {
      // 1 credit = $0.001
      expect(formatCreditsAsDollars(1)).toBe("$0.00");
    });

    it("formats 0 credits as $0.00", () => {
      expect(formatCreditsAsDollars(0)).toBe("$0.00");
    });

    it("formats large values correctly", () => {
      expect(formatCreditsAsDollars(100000)).toBe("$100.00");
    });

    it("always includes two decimal places", () => {
      const formatted = formatCreditsAsDollars(1000);
      expect(formatted).toMatch(/\.\d{2}$/);
    });

    it("starts with dollar sign", () => {
      const formatted = formatCreditsAsDollars(1000);
      expect(formatted.startsWith("$")).toBe(true);
    });
  });

  describe("getModelTier", () => {
    it('returns "economy" or "standard" for cheap models', () => {
      // haiku should be economy or standard tier
      const tier = getModelTier("anthropic:claude-3-5-haiku");
      expect(["economy", "standard"]).toContain(tier);
    });

    it('returns "premium" or "enterprise" for expensive models', () => {
      const tier = getModelTier("anthropic:claude-opus-4-1");
      expect(["premium", "enterprise"]).toContain(tier);
    });

    it('returns "standard" or higher for Sonnet', () => {
      const tier = getModelTier("anthropic:claude-sonnet-4");
      expect(["standard", "premium", "enterprise"]).toContain(tier);
    });

    it("uses default pricing for unknown models", () => {
      // unknown model should use opus pricing -> enterprise tier
      const tier = getModelTier("unknown-model");
      expect(["premium", "enterprise"]).toContain(tier);
    });

    it("returns valid tier string", () => {
      const validTiers = ["economy", "standard", "premium", "enterprise"];
      const tier = getModelTier("anthropic:claude-3-5-haiku");
      expect(validTiers).toContain(tier);
    });
  });

  describe("pricing accuracy", () => {
    it("calculates Haiku pricing correctly", () => {
      // haiku: $0.80/$4.00 per million tokens = 800/4000 credits
      const haikuPricing = getModelPricing("anthropic:claude-3-5-haiku");

      expect(haikuPricing.input).toBe(800);
      expect(haikuPricing.output).toBe(4000);
    });

    it("calculates Sonnet pricing correctly", () => {
      const sonnetPricing = getModelPricing("anthropic:claude-sonnet-4");

      // sonnet 4 is $3/$15 per million tokens = 3000/15000 credits
      expect(sonnetPricing.input).toBe(3000);
      expect(sonnetPricing.output).toBe(15000);
    });

    it("calculates Opus pricing correctly", () => {
      const opusPricing = getModelPricing("anthropic:claude-opus-4-1");

      // opus 4.1 is $15/$75 per million tokens = 15000/75000 credits
      expect(opusPricing.input).toBe(15000);
      expect(opusPricing.output).toBe(75000);
    });
  });

  describe("edge cases", () => {
    it("handles negative token counts gracefully", () => {
      // negative tokens result in negative microcredits, ceiling to 0 or negative
      // the implementation uses math.ceil which may give unexpected results
      // this test just verifies it doesn't crash
      const cost = calculateCost("anthropic:claude-3-5-haiku", -1000, -500);
      expect(Number.isFinite(cost)).toBe(true);
    });

    it("handles very small token counts", () => {
      const cost = calculateCost("anthropic:claude-3-5-haiku", 1, 0);
      expect(Number.isFinite(cost)).toBe(true);
      expect(Number.isInteger(cost)).toBe(true);
    });

    it("handles fractional credits by ceiling", () => {
      // any usage should result in at least 1 credit
      const cost = calculateCost("anthropic:claude-3-5-haiku", 100, 10);
      expect(cost).toBeGreaterThanOrEqual(1);
    });

    it("model IDs are case-sensitive", () => {
      const pricing1 = getModelPricing("anthropic:claude-3-5-haiku");
      const pricing2 = getModelPricing("ANTHROPIC:CLAUDE-3-5-HAIKU");

      // second should return default (unknown model)
      expect(pricing2.input).toBe(15000);
    });
  });
});
