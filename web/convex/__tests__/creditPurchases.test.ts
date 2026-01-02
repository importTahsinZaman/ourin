import { describe, it, expect } from "vitest";

/**
 * credit purchases business logic tests.
 * tests fIFO deduction, balance calculations, and status transitions
 * without requiring the convex runtime.
 */

// simulate purchase record
interface Purchase {
  id: string;
  creditsAmount: number;
  creditsRemaining: number;
  purchasedAt: number;
  status: "active" | "depleted";
}

// business logic: calculate balance from active purchases
function calculateBalance(purchases: Purchase[]): number {
  return purchases
    .filter((p) => p.status === "active")
    .reduce((sum, p) => sum + p.creditsRemaining, 0);
}

// business logic: fIFO deduction (oldest first)
function deductCredits(
  purchases: Purchase[],
  amount: number
): { purchases: Purchase[]; deducted: number; remaining: number } {
  // sort by purchasedAt (oldest first - fIFO)
  const sorted = [...purchases]
    .filter((p) => p.status === "active")
    .sort((a, b) => a.purchasedAt - b.purchasedAt);

  let remainingToDeduct = amount;
  const updatedPurchases: Purchase[] = [];

  for (const purchase of sorted) {
    if (remainingToDeduct <= 0) {
      updatedPurchases.push(purchase);
      continue;
    }

    const deductFromThis = Math.min(
      purchase.creditsRemaining,
      remainingToDeduct
    );
    const newBalance = purchase.creditsRemaining - deductFromThis;

    updatedPurchases.push({
      ...purchase,
      creditsRemaining: newBalance,
      status: newBalance === 0 ? "depleted" : "active",
    });

    remainingToDeduct -= deductFromThis;
  }

  // include depleted purchases unchanged
  const depletedPurchases = purchases.filter((p) => p.status === "depleted");

  return {
    purchases: [...updatedPurchases, ...depletedPurchases],
    deducted: amount - remainingToDeduct,
    remaining: remainingToDeduct,
  };
}

// business logic: check if purchase already exists (idempotency)
function purchaseExists(
  purchases: { stripePaymentIntentId: string }[],
  paymentIntentId: string
): boolean {
  return purchases.some((p) => p.stripePaymentIntentId === paymentIntentId);
}

describe("creditPurchases", () => {
  describe("calculateBalance", () => {
    it("returns 0 for empty purchases", () => {
      expect(calculateBalance([])).toBe(0);
    });

    it("returns balance of single active purchase", () => {
      const purchases: Purchase[] = [
        {
          id: "1",
          creditsAmount: 20000,
          creditsRemaining: 20000,
          purchasedAt: Date.now(),
          status: "active",
        },
      ];

      expect(calculateBalance(purchases)).toBe(20000);
    });

    it("sums multiple active purchases", () => {
      const purchases: Purchase[] = [
        {
          id: "1",
          creditsAmount: 20000,
          creditsRemaining: 15000,
          purchasedAt: Date.now() - 10000,
          status: "active",
        },
        {
          id: "2",
          creditsAmount: 20000,
          creditsRemaining: 20000,
          purchasedAt: Date.now(),
          status: "active",
        },
      ];

      expect(calculateBalance(purchases)).toBe(35000);
    });

    it("excludes depleted purchases", () => {
      const purchases: Purchase[] = [
        {
          id: "1",
          creditsAmount: 20000,
          creditsRemaining: 0,
          purchasedAt: Date.now() - 20000,
          status: "depleted",
        },
        {
          id: "2",
          creditsAmount: 20000,
          creditsRemaining: 10000,
          purchasedAt: Date.now(),
          status: "active",
        },
      ];

      expect(calculateBalance(purchases)).toBe(10000);
    });

    it("returns 0 when all purchases depleted", () => {
      const purchases: Purchase[] = [
        {
          id: "1",
          creditsAmount: 20000,
          creditsRemaining: 0,
          purchasedAt: Date.now() - 20000,
          status: "depleted",
        },
        {
          id: "2",
          creditsAmount: 20000,
          creditsRemaining: 0,
          purchasedAt: Date.now(),
          status: "depleted",
        },
      ];

      expect(calculateBalance(purchases)).toBe(0);
    });
  });

  describe("FIFO deduction", () => {
    it("deducts from oldest purchase first", () => {
      const purchases: Purchase[] = [
        {
          id: "new",
          creditsAmount: 20000,
          creditsRemaining: 20000,
          purchasedAt: Date.now(),
          status: "active",
        },
        {
          id: "old",
          creditsAmount: 20000,
          creditsRemaining: 20000,
          purchasedAt: Date.now() - 100000,
          status: "active",
        },
      ];

      const result = deductCredits(purchases, 5000);

      // old purchase should be deducted first
      const oldPurchase = result.purchases.find((p) => p.id === "old");
      const newPurchase = result.purchases.find((p) => p.id === "new");

      expect(oldPurchase?.creditsRemaining).toBe(15000);
      expect(newPurchase?.creditsRemaining).toBe(20000);
      expect(result.deducted).toBe(5000);
      expect(result.remaining).toBe(0);
    });

    it("depletes oldest purchase before moving to next", () => {
      const purchases: Purchase[] = [
        {
          id: "oldest",
          creditsAmount: 5000,
          creditsRemaining: 5000,
          purchasedAt: 1000,
          status: "active",
        },
        {
          id: "middle",
          creditsAmount: 10000,
          creditsRemaining: 10000,
          purchasedAt: 2000,
          status: "active",
        },
        {
          id: "newest",
          creditsAmount: 15000,
          creditsRemaining: 15000,
          purchasedAt: 3000,
          status: "active",
        },
      ];

      // deduct 8000 - should deplete oldest (5000) and take 3000 from middle
      const result = deductCredits(purchases, 8000);

      const oldest = result.purchases.find((p) => p.id === "oldest");
      const middle = result.purchases.find((p) => p.id === "middle");
      const newest = result.purchases.find((p) => p.id === "newest");

      expect(oldest?.creditsRemaining).toBe(0);
      expect(oldest?.status).toBe("depleted");
      expect(middle?.creditsRemaining).toBe(7000);
      expect(middle?.status).toBe("active");
      expect(newest?.creditsRemaining).toBe(15000);
      expect(result.deducted).toBe(8000);
    });

    it("sets status to depleted when balance hits 0", () => {
      const purchases: Purchase[] = [
        {
          id: "1",
          creditsAmount: 5000,
          creditsRemaining: 5000,
          purchasedAt: Date.now(),
          status: "active",
        },
      ];

      const result = deductCredits(purchases, 5000);

      expect(result.purchases[0].creditsRemaining).toBe(0);
      expect(result.purchases[0].status).toBe("depleted");
    });

    it("handles deduction larger than available credits", () => {
      const purchases: Purchase[] = [
        {
          id: "1",
          creditsAmount: 10000,
          creditsRemaining: 5000,
          purchasedAt: Date.now(),
          status: "active",
        },
      ];

      const result = deductCredits(purchases, 10000);

      expect(result.deducted).toBe(5000);
      expect(result.remaining).toBe(5000);
      expect(result.purchases[0].status).toBe("depleted");
    });

    it("returns 0 deducted when no active purchases", () => {
      const purchases: Purchase[] = [
        {
          id: "1",
          creditsAmount: 10000,
          creditsRemaining: 0,
          purchasedAt: Date.now(),
          status: "depleted",
        },
      ];

      const result = deductCredits(purchases, 5000);

      expect(result.deducted).toBe(0);
      expect(result.remaining).toBe(5000);
    });

    it("handles zero deduction amount", () => {
      const purchases: Purchase[] = [
        {
          id: "1",
          creditsAmount: 10000,
          creditsRemaining: 10000,
          purchasedAt: Date.now(),
          status: "active",
        },
      ];

      const result = deductCredits(purchases, 0);

      expect(result.deducted).toBe(0);
      expect(result.remaining).toBe(0);
      expect(result.purchases[0].creditsRemaining).toBe(10000);
    });

    it("depletes multiple purchases in order", () => {
      const purchases: Purchase[] = [
        {
          id: "1",
          creditsAmount: 5000,
          creditsRemaining: 5000,
          purchasedAt: 1000,
          status: "active",
        },
        {
          id: "2",
          creditsAmount: 5000,
          creditsRemaining: 5000,
          purchasedAt: 2000,
          status: "active",
        },
        {
          id: "3",
          creditsAmount: 5000,
          creditsRemaining: 5000,
          purchasedAt: 3000,
          status: "active",
        },
      ];

      // deduct 12000 - should deplete first two (10000) and take 2000 from third
      const result = deductCredits(purchases, 12000);

      const p1 = result.purchases.find((p) => p.id === "1");
      const p2 = result.purchases.find((p) => p.id === "2");
      const p3 = result.purchases.find((p) => p.id === "3");

      expect(p1?.status).toBe("depleted");
      expect(p2?.status).toBe("depleted");
      expect(p3?.creditsRemaining).toBe(3000);
      expect(p3?.status).toBe("active");
      expect(result.deducted).toBe(12000);
    });
  });

  describe("idempotency", () => {
    it("detects existing purchase by payment intent ID", () => {
      const purchases = [
        { stripePaymentIntentId: "pi_existing" },
        { stripePaymentIntentId: "pi_other" },
      ];

      expect(purchaseExists(purchases, "pi_existing")).toBe(true);
    });

    it("returns false for new payment intent ID", () => {
      const purchases = [{ stripePaymentIntentId: "pi_existing" }];

      expect(purchaseExists(purchases, "pi_new")).toBe(false);
    });

    it("handles empty purchases array", () => {
      expect(purchaseExists([], "pi_any")).toBe(false);
    });
  });

  describe("purchase scenarios", () => {
    it("tracks usage across multiple purchases correctly", () => {
      // user buys 3 credit packs over time
      let purchases: Purchase[] = [
        {
          id: "pack1",
          creditsAmount: 10000,
          creditsRemaining: 10000,
          purchasedAt: 1000,
          status: "active",
        },
      ];

      // use some credits
      let result = deductCredits(purchases, 3000);
      purchases = result.purchases;
      expect(calculateBalance(purchases)).toBe(7000);

      // buy another pack
      purchases.push({
        id: "pack2",
        creditsAmount: 10000,
        creditsRemaining: 10000,
        purchasedAt: 2000,
        status: "active",
      });
      expect(calculateBalance(purchases)).toBe(17000);

      // use more credits - should still deduct from pack1 first (fIFO)
      result = deductCredits(purchases, 8000);
      purchases = result.purchases;

      const pack1 = purchases.find((p) => p.id === "pack1");
      const pack2 = purchases.find((p) => p.id === "pack2");

      // pack1 had 7000, should be depleted (7000 used)
      // pack2 should have 10000 - 1000 = 9000
      expect(pack1?.status).toBe("depleted");
      expect(pack2?.creditsRemaining).toBe(9000);
      expect(calculateBalance(purchases)).toBe(9000);
    });

    it("handles partial depletion correctly", () => {
      const purchases: Purchase[] = [
        {
          id: "1",
          creditsAmount: 20000,
          creditsRemaining: 15000,
          purchasedAt: Date.now(),
          status: "active",
        },
      ];

      const result = deductCredits(purchases, 5000);

      expect(result.purchases[0].creditsRemaining).toBe(10000);
      expect(result.purchases[0].status).toBe("active");
      expect(calculateBalance(result.purchases)).toBe(10000);
    });
  });

  describe("edge cases", () => {
    it("handles very large credit amounts", () => {
      const purchases: Purchase[] = [
        {
          id: "1",
          creditsAmount: 1000000,
          creditsRemaining: 1000000,
          purchasedAt: Date.now(),
          status: "active",
        },
      ];

      expect(calculateBalance(purchases)).toBe(1000000);

      const result = deductCredits(purchases, 500000);
      expect(result.purchases[0].creditsRemaining).toBe(500000);
    });

    it("maintains correct balance through multiple operations", () => {
      let purchases: Purchase[] = [
        {
          id: "1",
          creditsAmount: 10000,
          creditsRemaining: 10000,
          purchasedAt: Date.now(),
          status: "active",
        },
      ];

      // series of deductions
      for (let i = 0; i < 10; i++) {
        const result = deductCredits(purchases, 1000);
        purchases = result.purchases;
      }

      expect(calculateBalance(purchases)).toBe(0);
      expect(purchases[0].status).toBe("depleted");
    });

    it("correctly reports when all credits exhausted", () => {
      const purchases: Purchase[] = [
        {
          id: "1",
          creditsAmount: 5000,
          creditsRemaining: 1000,
          purchasedAt: Date.now(),
          status: "active",
        },
      ];

      const result = deductCredits(purchases, 2000);

      expect(result.deducted).toBe(1000);
      expect(result.remaining).toBe(1000);
      expect(calculateBalance(result.purchases)).toBe(0);
    });
  });
});
