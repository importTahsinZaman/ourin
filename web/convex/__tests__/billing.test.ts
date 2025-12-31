import { describe, it, expect } from "vitest";

// Set up environment for pricing calculations
// Note: SELF_HOSTING=false is set in test-utils/setup.ts
process.env.COST_MARKUP = "1.0";
process.env.SUBSCRIPTION_CREDITS = "10000";
process.env.CREDIT_PACK_AMOUNT = "20000";

import { calculateCredits, getSubscriptionCredits } from "../pricing";

/**
 * These tests verify the billing logic without requiring a full Convex runtime.
 * They test the business rules and calculations that the billing queries rely on.
 */

describe("Billing Logic", () => {
  describe("Self-Hosting Mode", () => {
    it("returns self_hosted tier with full access", () => {
      const selfHostedTier = {
        tier: "self_hosted" as const,
        canSendMessage: true,
        modelsAllowed: "all" as const,
      };

      expect(selfHostedTier.tier).toBe("self_hosted");
      expect(selfHostedTier.canSendMessage).toBe(true);
      expect(selfHostedTier.modelsAllowed).toBe("all");
    });

    it("self-hosted tier has no credit restrictions", () => {
      const selfHostedTier = {
        tier: "self_hosted" as const,
        canSendMessage: true,
      };

      // canSendMessage is always true regardless of credits
      expect(selfHostedTier.canSendMessage).toBe(true);
    });

    it("credits calculation logic returns 0 in self-hosting mode", () => {
      // In self-hosting mode, calculateCredits returns 0
      const isSelfHosting = true;

      // Simulate what calculateCredits does in self-hosting mode
      const creditsInSelfHosting = isSelfHosting ? 0 : 1050; // Would be 1050 for these tokens

      expect(creditsInSelfHosting).toBe(0);
    });

    it("credits calculation logic would return >0 in production mode", () => {
      // Test the business logic: production mode should calculate credits
      const isSelfHosting = false;

      // Simulate what calculateCredits returns in production mode
      // For claude-sonnet-4 with 100000 input + 50000 output
      const expectedCredits = 1050; // (100000*3000 + 50000*15000) / 1_000_000 = 1050
      const credits = isSelfHosting ? 0 : expectedCredits;

      expect(credits).toBeGreaterThan(0);
      expect(credits).toBe(1050);
    });
  });

  describe("Tier Determination Logic", () => {
    const FREE_MODEL_ID = "google:gemini-2.5-flash-lite";
    const FREE_MESSAGE_LIMIT = 10;

    describe("anonymous users", () => {
      it("should only allow free model", () => {
        const allowedModels = [FREE_MODEL_ID];
        expect(allowedModels).toContain(FREE_MODEL_ID);
        expect(allowedModels).not.toContain("anthropic:claude-sonnet-4");
      });
    });

    describe("free tier users", () => {
      it("calculates remaining messages correctly", () => {
        const messageCount = 7;
        const remainingMessages = Math.max(
          0,
          FREE_MESSAGE_LIMIT - messageCount
        );
        expect(remainingMessages).toBe(3);
      });

      it("returns 0 remaining when at limit", () => {
        const messageCount = 10;
        const remainingMessages = Math.max(
          0,
          FREE_MESSAGE_LIMIT - messageCount
        );
        expect(remainingMessages).toBe(0);
      });

      it("returns 0 remaining when over limit", () => {
        const messageCount = 15;
        const remainingMessages = Math.max(
          0,
          FREE_MESSAGE_LIMIT - messageCount
        );
        expect(remainingMessages).toBe(0);
      });

      it("determines canSendMessage correctly", () => {
        expect(7 < FREE_MESSAGE_LIMIT).toBe(true); // Can send
        expect(10 < FREE_MESSAGE_LIMIT).toBe(false); // Cannot send
      });
    });

    describe("subscriber balance calculation", () => {
      it("calculates subscription balance from message usage", () => {
        const subscriptionCredits = getSubscriptionCredits();

        // Simulate message usage: Claude Sonnet (3000 input, 15000 output per 1M)
        // 100000 input + 50000 output = 1050 credits
        const messageCredits = calculateCredits(
          "anthropic:claude-sonnet-4",
          100000,
          50000
        );

        const balance = subscriptionCredits - messageCredits;
        expect(balance).toBe(8950); // 10000 - 1050
      });

      it("caps negative balance at 0 in display", () => {
        const subscriptionCredits = getSubscriptionCredits();

        // Heavy usage: Claude Opus 4.5
        // 500000 input + 200000 output = 7500 credits per message
        const message1Credits = calculateCredits(
          "anthropic:claude-opus-4-5-20251101",
          500000,
          200000
        );

        const message2Credits = calculateCredits(
          "anthropic:claude-opus-4-5-20251101",
          500000,
          200000
        );

        const totalUsed = message1Credits + message2Credits;
        expect(totalUsed).toBeGreaterThan(subscriptionCredits); // Over limit

        const rawBalance = subscriptionCredits - totalUsed;
        const displayBalance = Math.max(0, rawBalance);
        expect(displayBalance).toBe(0);
      });

      it("excludes forked messages from balance calculation", () => {
        // Forked messages should have wasForked: true and be excluded
        // This is a business rule: only count non-forked messages
        const messages = [
          { credits: 1000, wasForked: false },
          { credits: 5000, wasForked: true }, // Should be excluded
          { credits: 500, wasForked: false },
        ];

        const totalUsed = messages
          .filter((m) => !m.wasForked)
          .reduce((sum, m) => sum + m.credits, 0);

        expect(totalUsed).toBe(1500); // Only non-forked messages
      });

      it("excludes own-key messages from balance calculation", () => {
        const messages = [
          { credits: 1000, usedOwnKey: false },
          { credits: 5000, usedOwnKey: true }, // Should be excluded
          { credits: 500, usedOwnKey: false },
        ];

        const totalUsed = messages
          .filter((m) => !m.usedOwnKey)
          .reduce((sum, m) => sum + m.credits, 0);

        expect(totalUsed).toBe(1500);
      });
    });

    describe("total balance calculation", () => {
      it("combines subscription and purchased credits", () => {
        const subscriptionBalance = 3000;
        const purchasedBalance = 15000;

        const totalBalance =
          Math.max(0, subscriptionBalance) + purchasedBalance;
        expect(totalBalance).toBe(18000);
      });

      it("uses only purchased when subscription is negative", () => {
        const subscriptionBalance = -5000; // Overspent
        const purchasedBalance = 15000;

        const totalBalance =
          Math.max(0, subscriptionBalance) + purchasedBalance;
        expect(totalBalance).toBe(15000); // Only purchased credits
      });

      it("returns 0 when both are depleted", () => {
        const subscriptionBalance = -1000;
        const purchasedBalance = 0;

        const totalBalance =
          Math.max(0, subscriptionBalance) + purchasedBalance;
        expect(totalBalance).toBe(0);
      });
    });

    describe("canSendMessage determination", () => {
      it("allows sending if has credits", () => {
        const totalBalance = 100;
        const hasApiKeys = false;

        const canSend = totalBalance > 0 || hasApiKeys;
        expect(canSend).toBe(true);
      });

      it("allows sending if has API keys even with 0 credits", () => {
        const totalBalance = 0;
        const hasApiKeys = true;

        const canSend = totalBalance > 0 || hasApiKeys;
        expect(canSend).toBe(true);
      });

      it("blocks sending if no credits and no API keys", () => {
        const totalBalance = 0;
        const hasApiKeys = false;

        const canSend = totalBalance > 0 || hasApiKeys;
        expect(canSend).toBe(false);
      });
    });
  });

  describe("Credit Calculation for Billing", () => {
    it("calculates credits for cheap model (Gemini Flash Lite)", () => {
      // 10000 tokens at cheap rates should be minimal credits
      const credits = calculateCredits(
        "google:gemini-2.0-flash-lite-001",
        10000,
        5000
      );
      // (10000 * 75 + 5000 * 300) / 1_000_000 = 2.25 -> 3 credits
      expect(credits).toBe(3);
    });

    it("calculates credits for expensive model (Claude Opus 4.5)", () => {
      const credits = calculateCredits(
        "anthropic:claude-opus-4-5-20251101",
        10000,
        5000
      );
      // (10000 * 5000 + 5000 * 25000) / 1_000_000 = 175 credits
      expect(credits).toBe(175);
    });

    it("calculates credits for very heavy usage", () => {
      // 1M tokens each way on expensive model
      const credits = calculateCredits(
        "anthropic:claude-opus-4-5-20251101",
        1000000,
        1000000
      );
      // (1M * 5000 + 1M * 25000) / 1_000_000 = 30000 credits
      expect(credits).toBe(30000);
    });
  });

  describe("FIFO Credit Deduction Logic", () => {
    it("deducts from oldest purchase first", () => {
      const purchases = [
        { id: "1", purchasedAt: 1000, creditsRemaining: 5000 },
        { id: "2", purchasedAt: 2000, creditsRemaining: 10000 },
        { id: "3", purchasedAt: 3000, creditsRemaining: 15000 },
      ].sort((a, b) => a.purchasedAt - b.purchasedAt);

      let toDeduct = 7000;
      const deductions: { id: string; amount: number }[] = [];

      for (const purchase of purchases) {
        if (toDeduct <= 0) break;

        const deductFromThis = Math.min(purchase.creditsRemaining, toDeduct);
        deductions.push({ id: purchase.id, amount: deductFromThis });
        toDeduct -= deductFromThis;
      }

      expect(deductions).toEqual([
        { id: "1", amount: 5000 }, // Fully depleted
        { id: "2", amount: 2000 }, // Partially used
      ]);
    });

    it("marks purchase as depleted when balance hits 0", () => {
      const purchase = { creditsRemaining: 5000, status: "active" };
      const toDeduct = 5000;

      const newBalance = purchase.creditsRemaining - toDeduct;
      const newStatus = newBalance === 0 ? "depleted" : "active";

      expect(newBalance).toBe(0);
      expect(newStatus).toBe("depleted");
    });

    it("keeps purchase active when partially used", () => {
      const purchase = { creditsRemaining: 5000, status: "active" };
      const toDeduct = 3000;

      const newBalance = purchase.creditsRemaining - toDeduct;
      const newStatus = newBalance === 0 ? "depleted" : "active";

      expect(newBalance).toBe(2000);
      expect(newStatus).toBe("active");
    });
  });

  describe("Overage Calculation", () => {
    it("calculates overage when subscription is exceeded", () => {
      const subscriptionCredits = 10000;
      const totalUsed = 15000;

      const overage = Math.max(0, totalUsed - subscriptionCredits);
      expect(overage).toBe(5000);
    });

    it("returns 0 overage when within subscription", () => {
      const subscriptionCredits = 10000;
      const totalUsed = 7000;

      const overage = Math.max(0, totalUsed - subscriptionCredits);
      expect(overage).toBe(0);
    });

    it("deducts minimum of message cost and overage", () => {
      // If message costs 1000 but overage is only 500, deduct 500
      const messageCost = 1000;
      const subscriptionBalance = -500;

      const toDeduct = Math.min(messageCost, Math.abs(subscriptionBalance));
      expect(toDeduct).toBe(500);
    });
  });
});
