import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// we need to test the pricing module which uses process.env
// set up environment before importing the module
process.env.COST_MARKUP = "1.0";
process.env.SUBSCRIPTION_CREDITS = "10000";
process.env.CREDIT_PACK_AMOUNT = "20000";

import {
  calculateCredits,
  getSubscriptionCredits,
  getCreditPackAmount,
  MODEL_PRICING,
} from "../pricing";

describe("calculateCredits", () => {
  beforeEach(() => {
    process.env.COST_MARKUP = "1.0";
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("known models", () => {
    it("calculates correctly for Gemini Flash Lite (cheapest model)", () => {
      // pricing: input: 75, output: 300 per 1m tokens
      // 1000 input + 500 output = (1000 * 75 + 500 * 300) / 1_000_000 = 0.225
      // ceiling = 1 credit
      const credits = calculateCredits(
        "google:gemini-2.5-flash-lite",
        1000,
        500
      );
      expect(credits).toBe(1);
    });

    it("calculates correctly for Claude Opus 4.5 (expensive model)", () => {
      // pricing: input: 5000, output: 25000 per 1m tokens
      // 10000 input + 5000 output = (10000 * 5000 + 5000 * 25000) / 1_000_000 = 175
      const credits = calculateCredits(
        "anthropic:claude-opus-4-5-20251101",
        10000,
        5000
      );
      expect(credits).toBe(175);
    });

    it("calculates correctly for GPT-5.1", () => {
      // pricing: input: 1250, output: 10000 per 1m tokens
      // 50000 input + 10000 output = (50000 * 1250 + 10000 * 10000) / 1_000_000 = 162.5
      // ceiling = 163 credits
      const credits = calculateCredits("openai:gpt-5.1", 50000, 10000);
      expect(credits).toBe(163);
    });

    it("calculates correctly for Claude Sonnet 4", () => {
      // pricing: input: 3000, output: 15000 per 1m tokens
      // 100000 input + 50000 output = (100000 * 3000 + 50000 * 15000) / 1_000_000 = 1050
      const credits = calculateCredits(
        "anthropic:claude-sonnet-4",
        100000,
        50000
      );
      expect(credits).toBe(1050);
    });
  });

  describe("edge cases", () => {
    it("handles zero tokens", () => {
      const credits = calculateCredits("google:gemini-2.5-flash-lite", 0, 0);
      expect(credits).toBe(0);
    });

    it("handles zero input tokens", () => {
      // 0 input + 1000 output at 300 per 1m = 0.3 credits -> ceiling = 1
      const credits = calculateCredits("google:gemini-2.5-flash-lite", 0, 1000);
      expect(credits).toBe(1);
    });

    it("handles zero output tokens", () => {
      // 1000 input + 0 output at 75 per 1m = 0.075 credits -> ceiling = 1
      const credits = calculateCredits("google:gemini-2.5-flash-lite", 1000, 0);
      expect(credits).toBe(1);
    });

    it("handles very large token counts without overflow", () => {
      // 10m input + 1m output on expensive model
      // (10_000_000 * 5000 + 1_000_000 * 25000) / 1_000_000 = 50000 + 25000 = 75000
      const credits = calculateCredits(
        "anthropic:claude-opus-4-5-20251101",
        10_000_000,
        1_000_000
      );
      expect(credits).toBe(75000);
    });

    it("rounds up to nearest credit (never undercharges)", () => {
      // smallest possible charge: 1 input token at cheapest rate
      // 1 * 75 / 1_000_000 = 0.000075 -> ceiling = 1
      const credits = calculateCredits("google:gemini-2.5-flash-lite", 1, 0);
      expect(credits).toBe(1);
    });
  });

  describe("unknown models", () => {
    it("uses conservative default pricing for unknown models", () => {
      // default pricing: input: 15000, output: 75000 (claude opus rates)
      // 1000 input + 1000 output = (1000 * 15000 + 1000 * 75000) / 1_000_000 = 90
      const credits = calculateCredits("unknown:model", 1000, 1000);
      expect(credits).toBe(90);
    });

    it("warns about unknown model", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      calculateCredits("totally:unknown", 100, 100);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown model "totally:unknown"')
      );
      warnSpy.mockRestore();
    });
  });

  describe("cost markup", () => {
    it("applies COST_MARKUP multiplier", () => {
      process.env.COST_MARKUP = "1.5";

      // gemini 2.5 flash lite pricing: input: 100, output: 400
      // 10000 * 100 + 5000 * 400 = 3000000 = 3 credits
      // with 1.5x markup: 4.5 -> ceiling = 5
      const credits = calculateCredits(
        "google:gemini-2.5-flash-lite",
        10000,
        5000
      );
      expect(credits).toBe(5);
    });

    it("handles invalid COST_MARKUP (falls back to 1.0)", () => {
      process.env.COST_MARKUP = "invalid";

      // should use 1.0 markup (no change)
      // gemini 2.5 flash lite: 10000 * 100 + 5000 * 400 = 3000000 = 3 credits
      const credits = calculateCredits(
        "google:gemini-2.5-flash-lite",
        10000,
        5000
      );
      expect(credits).toBe(3);
    });

    it("handles missing COST_MARKUP (defaults to 1.0)", () => {
      delete process.env.COST_MARKUP;

      const credits = calculateCredits(
        "google:gemini-2.5-flash-lite",
        10000,
        5000
      );
      expect(credits).toBe(3);
    });
  });
});

describe("getSubscriptionCredits", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns default 10000 when not set", () => {
    delete process.env.SUBSCRIPTION_CREDITS;
    expect(getSubscriptionCredits()).toBe(10000);
  });

  it("returns configured value", () => {
    process.env.SUBSCRIPTION_CREDITS = "50000";
    expect(getSubscriptionCredits()).toBe(50000);
  });

  it("handles invalid value (returns default)", () => {
    process.env.SUBSCRIPTION_CREDITS = "invalid";
    expect(getSubscriptionCredits()).toBe(10000);
  });
});

describe("getCreditPackAmount", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns default 20000 when not set", () => {
    delete process.env.CREDIT_PACK_AMOUNT;
    expect(getCreditPackAmount()).toBe(20000);
  });

  it("returns configured value", () => {
    process.env.CREDIT_PACK_AMOUNT = "100000";
    expect(getCreditPackAmount()).toBe(100000);
  });

  it("handles invalid value (returns default)", () => {
    process.env.CREDIT_PACK_AMOUNT = "not-a-number";
    expect(getCreditPackAmount()).toBe(20000);
  });
});

describe("MODEL_PRICING", () => {
  it("contains all expected models", () => {
    expect(MODEL_PRICING).toHaveProperty("google:gemini-2.5-flash-lite");
    expect(MODEL_PRICING).toHaveProperty("anthropic:claude-opus-4-5-20251101");
    expect(MODEL_PRICING).toHaveProperty("openai:gpt-5.1");
  });

  it("has valid pricing structure for all models", () => {
    for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
      expect(pricing).toHaveProperty("input");
      expect(pricing).toHaveProperty("output");
      expect(typeof pricing.input).toBe("number");
      expect(typeof pricing.output).toBe("number");
      expect(pricing.input).toBeGreaterThan(0);
      expect(pricing.output).toBeGreaterThan(0);
    }
  });
});
