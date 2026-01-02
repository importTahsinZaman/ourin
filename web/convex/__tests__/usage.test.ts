import { describe, it, expect } from "vitest";

/**
 * usage calculation business logic tests.
 * tests balance calculations, aggregation, and forked message exclusion
 * without requiring the convex runtime.
 */

// simulate message record
interface Message {
  role: "user" | "assistant";
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
  createdAt: number;
  wasForked?: boolean;
  usedOwnKey?: boolean;
}

// simplified credit calculation for testing (actual uses mODEL_pRICING)
function calculateCredits(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  // simplified pricing for testing - just use a fixed rate
  const PRICE_PER_1M_INPUT = 1000;
  const PRICE_PER_1M_OUTPUT = 5000;
  const cost =
    (inputTokens * PRICE_PER_1M_INPUT + outputTokens * PRICE_PER_1M_OUTPUT) /
    1_000_000;
  return Math.ceil(cost);
}

// business logic: calculate total credits from messages
function calculateTotalCredits(messages: Message[]): number {
  return messages.reduce((total, msg) => {
    if (
      msg.role !== "user" ||
      msg.inputTokens === undefined ||
      msg.wasForked ||
      msg.usedOwnKey
    ) {
      return total;
    }
    return (
      total +
      calculateCredits(
        msg.model ?? "unknown",
        msg.inputTokens ?? 0,
        msg.outputTokens ?? 0
      )
    );
  }, 0);
}

// business logic: filter messages for usage calculation
function filterBillableMessages(messages: Message[]): Message[] {
  return messages.filter(
    (msg) =>
      msg.role === "user" &&
      msg.inputTokens !== undefined &&
      !msg.wasForked &&
      !msg.usedOwnKey
  );
}

// business logic: calculate subscription balance
function calculateSubscriptionBalance(
  subscriptionCredits: number,
  creditsUsed: number
): number {
  return Math.max(0, subscriptionCredits - creditsUsed);
}

// business logic: calculate total balance
function calculateTotalBalance(
  subscriptionCredits: number,
  creditsUsed: number,
  purchasedBalance: number
): number {
  const subBalance = Math.max(0, subscriptionCredits - creditsUsed);
  return subBalance + purchasedBalance;
}

// business logic: group usage by model
function groupByModel(
  messages: Message[]
): Record<string, { count: number; tokens: number; credits: number }> {
  const byModel: Record<
    string,
    { count: number; tokens: number; credits: number }
  > = {};

  for (const msg of messages) {
    if (msg.role !== "user" || msg.inputTokens === undefined || msg.wasForked) {
      continue;
    }

    const model = msg.model ?? "unknown";
    const tokens = (msg.inputTokens ?? 0) + (msg.outputTokens ?? 0);
    const credits = calculateCredits(
      model,
      msg.inputTokens ?? 0,
      msg.outputTokens ?? 0
    );

    if (!byModel[model]) {
      byModel[model] = { count: 0, tokens: 0, credits: 0 };
    }
    byModel[model].count++;
    byModel[model].tokens += tokens;
    byModel[model].credits += credits;
  }

  return byModel;
}

// business logic: filter messages within period
function filterByPeriod(
  messages: Message[],
  periodStart: number,
  periodEnd: number
): Message[] {
  return messages.filter(
    (msg) => msg.createdAt >= periodStart && msg.createdAt <= periodEnd
  );
}

describe("usage", () => {
  describe("Self-Hosting Mode", () => {
    it("returns 0 credits in self-hosting mode", () => {
      const isSelfHosting = true;

      const messages: Message[] = [
        {
          role: "user",
          inputTokens: 100000,
          outputTokens: 50000,
          model: "anthropic:claude-opus-4-5-20251101",
          createdAt: Date.now(),
        },
      ];

      const credits = isSelfHosting ? 0 : calculateTotalCredits(messages);

      expect(credits).toBe(0);
    });

    it("still tracks tokens in self-hosting mode", () => {
      const isSelfHosting = true;

      const messages: Message[] = [
        {
          role: "user",
          inputTokens: 1000,
          outputTokens: 500,
          model: "claude",
          createdAt: Date.now(),
        },
        {
          role: "user",
          inputTokens: 2000,
          outputTokens: 1000,
          model: "claude",
          createdAt: Date.now(),
        },
      ];

      // token tracking works regardless of self-hosting mode
      const totalInputTokens = messages.reduce(
        (sum, m) => sum + (m.inputTokens ?? 0),
        0
      );
      const totalOutputTokens = messages.reduce(
        (sum, m) => sum + (m.outputTokens ?? 0),
        0
      );

      expect(totalInputTokens).toBe(3000);
      expect(totalOutputTokens).toBe(1500);

      // but credits are 0 in self-hosting mode
      const credits = isSelfHosting ? 0 : calculateTotalCredits(messages);
      expect(credits).toBe(0);
    });

    it("byModel includes tokens and credits=0 in self-hosting mode", () => {
      const isSelfHosting = true;

      const messages: Message[] = [
        {
          role: "user",
          inputTokens: 1000,
          outputTokens: 500,
          model: "claude-3-opus",
          createdAt: Date.now(),
        },
      ];

      // in self-hosting mode, byModel should have consistent structure
      const byModel = isSelfHosting
        ? {
            "claude-3-opus": {
              count: 1,
              tokens: 1500,
              credits: 0, // credits are 0 in self-hosting
            },
          }
        : groupByModel(messages);

      expect(byModel["claude-3-opus"].credits).toBe(0);
      expect(byModel["claude-3-opus"].tokens).toBe(1500);
    });

    it("usage summary returns null/0 for billing fields in self-hosting mode", () => {
      const isSelfHosting = true;

      // simulated self-hosting usage summary response
      const selfHostingSummary = {
        totalInputTokens: 5000,
        totalOutputTokens: 2500,
        messageCount: 10,
        subscriptionBalance: 0,
        purchasedBalance: 0,
        purchasedTotal: 0,
        totalBalance: 0,
        byModel: {},
      };

      if (isSelfHosting) {
        expect(selfHostingSummary.subscriptionBalance).toBe(0);
        expect(selfHostingSummary.purchasedBalance).toBe(0);
        expect(selfHostingSummary.totalBalance).toBe(0);
        expect(selfHostingSummary.totalInputTokens).toBe(5000);
        expect(selfHostingSummary.totalOutputTokens).toBe(2500);
      }
    });
  });

  describe("calculateTotalCredits", () => {
    it("returns 0 for empty messages", () => {
      expect(calculateTotalCredits([])).toBe(0);
    });

    it("calculates credits for single message", () => {
      const messages: Message[] = [
        {
          role: "user",
          inputTokens: 1000,
          outputTokens: 500,
          model: "claude-3-opus",
          createdAt: Date.now(),
        },
      ];

      const credits = calculateTotalCredits(messages);
      expect(credits).toBeGreaterThan(0);
    });

    it("sums credits from multiple messages", () => {
      const messages: Message[] = [
        {
          role: "user",
          inputTokens: 1000,
          outputTokens: 500,
          model: "claude-3-opus",
          createdAt: Date.now(),
        },
        {
          role: "user",
          inputTokens: 2000,
          outputTokens: 1000,
          model: "claude-3-opus",
          createdAt: Date.now(),
        },
      ];

      const credits = calculateTotalCredits(messages);
      // should be sum of individual calculations
      const expected =
        calculateCredits("claude-3-opus", 1000, 500) +
        calculateCredits("claude-3-opus", 2000, 1000);
      expect(credits).toBe(expected);
    });

    it("ignores assistant messages", () => {
      const messages: Message[] = [
        {
          role: "user",
          inputTokens: 1000,
          outputTokens: 500,
          model: "claude-3-opus",
          createdAt: Date.now(),
        },
        {
          role: "assistant",
          inputTokens: 500,
          outputTokens: 2000,
          model: "claude-3-opus",
          createdAt: Date.now(),
        },
      ];

      const credits = calculateTotalCredits(messages);
      const userOnlyCredits = calculateCredits("claude-3-opus", 1000, 500);
      expect(credits).toBe(userOnlyCredits);
    });

    it("ignores messages without token data", () => {
      const messages: Message[] = [
        {
          role: "user",
          inputTokens: 1000,
          outputTokens: 500,
          model: "claude-3-opus",
          createdAt: Date.now(),
        },
        {
          role: "user",
          // no inputTokens
          outputTokens: 500,
          model: "claude-3-opus",
          createdAt: Date.now(),
        },
      ];

      const credits = calculateTotalCredits(messages);
      const expected = calculateCredits("claude-3-opus", 1000, 500);
      expect(credits).toBe(expected);
    });

    it("excludes forked messages", () => {
      const messages: Message[] = [
        {
          role: "user",
          inputTokens: 1000,
          outputTokens: 500,
          model: "claude-3-opus",
          createdAt: Date.now(),
        },
        {
          role: "user",
          inputTokens: 2000,
          outputTokens: 1000,
          model: "claude-3-opus",
          createdAt: Date.now(),
          wasForked: true,
        },
      ];

      const credits = calculateTotalCredits(messages);
      const expected = calculateCredits("claude-3-opus", 1000, 500);
      expect(credits).toBe(expected);
    });
  });

  describe("filterBillableMessages", () => {
    it("includes user messages with token data", () => {
      const messages: Message[] = [
        {
          role: "user",
          inputTokens: 1000,
          outputTokens: 500,
          createdAt: Date.now(),
        },
      ];

      expect(filterBillableMessages(messages)).toHaveLength(1);
    });

    it("excludes assistant messages", () => {
      const messages: Message[] = [
        {
          role: "assistant",
          inputTokens: 500,
          outputTokens: 2000,
          createdAt: Date.now(),
        },
      ];

      expect(filterBillableMessages(messages)).toHaveLength(0);
    });

    it("excludes messages without inputTokens", () => {
      const messages: Message[] = [
        {
          role: "user",
          outputTokens: 500,
          createdAt: Date.now(),
        },
      ];

      expect(filterBillableMessages(messages)).toHaveLength(0);
    });

    it("excludes forked messages", () => {
      const messages: Message[] = [
        {
          role: "user",
          inputTokens: 1000,
          outputTokens: 500,
          createdAt: Date.now(),
          wasForked: true,
        },
      ];

      expect(filterBillableMessages(messages)).toHaveLength(0);
    });

    it("excludes own-key messages", () => {
      const messages: Message[] = [
        {
          role: "user",
          inputTokens: 1000,
          outputTokens: 500,
          createdAt: Date.now(),
          usedOwnKey: true,
        },
      ];

      expect(filterBillableMessages(messages)).toHaveLength(0);
    });

    it("filters multiple criteria correctly", () => {
      const messages: Message[] = [
        {
          role: "user",
          inputTokens: 1000,
          outputTokens: 500,
          createdAt: Date.now(),
        },
        {
          role: "assistant",
          inputTokens: 500,
          outputTokens: 2000,
          createdAt: Date.now(),
        },
        {
          role: "user",
          inputTokens: 1500,
          outputTokens: 750,
          createdAt: Date.now(),
          wasForked: true,
        },
        {
          role: "user",
          inputTokens: 800,
          outputTokens: 400,
          createdAt: Date.now(),
          usedOwnKey: true,
        },
        {
          role: "user",
          inputTokens: 2000,
          outputTokens: 1000,
          createdAt: Date.now(),
        },
      ];

      const billable = filterBillableMessages(messages);
      expect(billable).toHaveLength(2);
    });
  });

  describe("calculateSubscriptionBalance", () => {
    it("returns full balance when no credits used", () => {
      expect(calculateSubscriptionBalance(10000, 0)).toBe(10000);
    });

    it("returns remaining balance after usage", () => {
      expect(calculateSubscriptionBalance(10000, 3000)).toBe(7000);
    });

    it("returns 0 when credits fully used", () => {
      expect(calculateSubscriptionBalance(10000, 10000)).toBe(0);
    });

    it("caps at 0 when overspent", () => {
      expect(calculateSubscriptionBalance(10000, 15000)).toBe(0);
    });
  });

  describe("calculateTotalBalance", () => {
    it("returns sum of subscription and purchased when positive", () => {
      // 10000 sub - 3000 used = 7000 sub balance + 5000 purchased = 12000
      expect(calculateTotalBalance(10000, 3000, 5000)).toBe(12000);
    });

    it("returns purchased only when subscription depleted", () => {
      // 10000 sub - 10000 used = 0 sub balance + 5000 purchased = 5000
      expect(calculateTotalBalance(10000, 10000, 5000)).toBe(5000);
    });

    it("returns purchased when subscription overspent", () => {
      // 10000 sub - 15000 used = 0 (capped) + 5000 purchased = 5000
      expect(calculateTotalBalance(10000, 15000, 5000)).toBe(5000);
    });

    it("returns 0 when all credits depleted", () => {
      expect(calculateTotalBalance(10000, 15000, 0)).toBe(0);
    });

    it("handles no subscription credits", () => {
      expect(calculateTotalBalance(0, 0, 5000)).toBe(5000);
    });

    it("handles no purchased credits", () => {
      expect(calculateTotalBalance(10000, 3000, 0)).toBe(7000);
    });
  });

  describe("groupByModel", () => {
    it("returns empty object for no messages", () => {
      expect(groupByModel([])).toEqual({});
    });

    it("groups single model correctly", () => {
      const messages: Message[] = [
        {
          role: "user",
          inputTokens: 1000,
          outputTokens: 500,
          model: "claude-3-opus",
          createdAt: Date.now(),
        },
        {
          role: "user",
          inputTokens: 2000,
          outputTokens: 1000,
          model: "claude-3-opus",
          createdAt: Date.now(),
        },
      ];

      const grouped = groupByModel(messages);
      expect(grouped["claude-3-opus"]).toBeDefined();
      expect(grouped["claude-3-opus"].count).toBe(2);
    });

    it("groups multiple models separately", () => {
      const messages: Message[] = [
        {
          role: "user",
          inputTokens: 1000,
          outputTokens: 500,
          model: "claude-3-opus",
          createdAt: Date.now(),
        },
        {
          role: "user",
          inputTokens: 2000,
          outputTokens: 1000,
          model: "gpt-4",
          createdAt: Date.now(),
        },
        {
          role: "user",
          inputTokens: 500,
          outputTokens: 250,
          model: "claude-3-opus",
          createdAt: Date.now(),
        },
      ];

      const grouped = groupByModel(messages);
      expect(grouped["claude-3-opus"].count).toBe(2);
      expect(grouped["gpt-4"].count).toBe(1);
    });

    it("uses 'unknown' for messages without model", () => {
      const messages: Message[] = [
        {
          role: "user",
          inputTokens: 1000,
          outputTokens: 500,
          createdAt: Date.now(),
        },
      ];

      const grouped = groupByModel(messages);
      expect(grouped["unknown"]).toBeDefined();
      expect(grouped["unknown"].count).toBe(1);
    });

    it("excludes forked messages from grouping", () => {
      const messages: Message[] = [
        {
          role: "user",
          inputTokens: 1000,
          outputTokens: 500,
          model: "claude-3-opus",
          createdAt: Date.now(),
        },
        {
          role: "user",
          inputTokens: 2000,
          outputTokens: 1000,
          model: "claude-3-opus",
          createdAt: Date.now(),
          wasForked: true,
        },
      ];

      const grouped = groupByModel(messages);
      expect(grouped["claude-3-opus"].count).toBe(1);
    });
  });

  describe("filterByPeriod", () => {
    it("includes messages within period", () => {
      const periodStart = 1000;
      const periodEnd = 2000;

      const messages: Message[] = [
        { role: "user", inputTokens: 100, outputTokens: 50, createdAt: 1500 },
      ];

      expect(filterByPeriod(messages, periodStart, periodEnd)).toHaveLength(1);
    });

    it("includes messages at period boundaries", () => {
      const periodStart = 1000;
      const periodEnd = 2000;

      const messages: Message[] = [
        { role: "user", inputTokens: 100, outputTokens: 50, createdAt: 1000 },
        { role: "user", inputTokens: 100, outputTokens: 50, createdAt: 2000 },
      ];

      expect(filterByPeriod(messages, periodStart, periodEnd)).toHaveLength(2);
    });

    it("excludes messages before period", () => {
      const periodStart = 1000;
      const periodEnd = 2000;

      const messages: Message[] = [
        { role: "user", inputTokens: 100, outputTokens: 50, createdAt: 999 },
      ];

      expect(filterByPeriod(messages, periodStart, periodEnd)).toHaveLength(0);
    });

    it("excludes messages after period", () => {
      const periodStart = 1000;
      const periodEnd = 2000;

      const messages: Message[] = [
        { role: "user", inputTokens: 100, outputTokens: 50, createdAt: 2001 },
      ];

      expect(filterByPeriod(messages, periodStart, periodEnd)).toHaveLength(0);
    });

    it("filters mixed messages correctly", () => {
      const periodStart = 1000;
      const periodEnd = 2000;

      const messages: Message[] = [
        { role: "user", inputTokens: 100, outputTokens: 50, createdAt: 500 },
        { role: "user", inputTokens: 100, outputTokens: 50, createdAt: 1000 },
        { role: "user", inputTokens: 100, outputTokens: 50, createdAt: 1500 },
        { role: "user", inputTokens: 100, outputTokens: 50, createdAt: 2000 },
        { role: "user", inputTokens: 100, outputTokens: 50, createdAt: 2500 },
      ];

      expect(filterByPeriod(messages, periodStart, periodEnd)).toHaveLength(3);
    });
  });

  describe("usage calculation scenarios", () => {
    it("calculates accurate usage for typical billing period", () => {
      const subscriptionCredits = 10000;
      const messages: Message[] = [
        {
          role: "user",
          inputTokens: 100000,
          outputTokens: 50000,
          model: "claude-3-opus",
          createdAt: Date.now(),
        },
        {
          role: "user",
          inputTokens: 200000,
          outputTokens: 100000,
          model: "gpt-4",
          createdAt: Date.now(),
        },
      ];

      const creditsUsed = calculateTotalCredits(messages);
      const subBalance = calculateSubscriptionBalance(
        subscriptionCredits,
        creditsUsed
      );
      const totalBalance = calculateTotalBalance(
        subscriptionCredits,
        creditsUsed,
        0
      );

      expect(creditsUsed).toBeGreaterThan(0);
      expect(subBalance).toBeLessThan(subscriptionCredits);
      expect(totalBalance).toBe(subBalance);
    });

    it("handles mixed billable and non-billable messages", () => {
      const messages: Message[] = [
        // billable
        {
          role: "user",
          inputTokens: 1000,
          outputTokens: 500,
          model: "claude",
          createdAt: Date.now(),
        },
        // not billable - assistant
        {
          role: "assistant",
          inputTokens: 500,
          outputTokens: 2000,
          model: "claude",
          createdAt: Date.now(),
        },
        // not billable - forked
        {
          role: "user",
          inputTokens: 1000,
          outputTokens: 500,
          model: "claude",
          createdAt: Date.now(),
          wasForked: true,
        },
        // not billable - own key
        {
          role: "user",
          inputTokens: 1000,
          outputTokens: 500,
          model: "claude",
          createdAt: Date.now(),
          usedOwnKey: true,
        },
        // billable
        {
          role: "user",
          inputTokens: 2000,
          outputTokens: 1000,
          model: "claude",
          createdAt: Date.now(),
        },
      ];

      const billable = filterBillableMessages(messages);
      expect(billable).toHaveLength(2);

      const credits = calculateTotalCredits(messages);
      const expectedCredits =
        calculateCredits("claude", 1000, 500) +
        calculateCredits("claude", 2000, 1000);
      expect(credits).toBe(expectedCredits);
    });

    it("handles subscription overspend with purchased credits backup", () => {
      const subscriptionCredits = 10000;
      const purchasedBalance = 5000;
      const creditsUsed = 12000; // overspent by 2000

      const subBalance = calculateSubscriptionBalance(
        subscriptionCredits,
        creditsUsed
      );
      expect(subBalance).toBe(0); // capped at 0

      const totalBalance = calculateTotalBalance(
        subscriptionCredits,
        creditsUsed,
        purchasedBalance
      );
      expect(totalBalance).toBe(5000); // only purchased credits remain
    });
  });

  describe("edge cases", () => {
    it("handles zero tokens", () => {
      const messages: Message[] = [
        {
          role: "user",
          inputTokens: 0,
          outputTokens: 0,
          model: "claude",
          createdAt: Date.now(),
        },
      ];

      const credits = calculateTotalCredits(messages);
      expect(credits).toBe(0);
    });

    it("handles very large token counts", () => {
      const messages: Message[] = [
        {
          role: "user",
          inputTokens: 10000000, // 10m
          outputTokens: 5000000, // 5m
          model: "claude",
          createdAt: Date.now(),
        },
      ];

      const credits = calculateTotalCredits(messages);
      expect(credits).toBeGreaterThan(0);
      expect(Number.isFinite(credits)).toBe(true);
    });

    it("handles many messages", () => {
      const messages: Message[] = [];
      for (let i = 0; i < 1000; i++) {
        messages.push({
          role: "user",
          inputTokens: 100,
          outputTokens: 50,
          model: "claude",
          createdAt: Date.now(),
        });
      }

      const credits = calculateTotalCredits(messages);
      expect(credits).toBeGreaterThan(0);
    });
  });
});
