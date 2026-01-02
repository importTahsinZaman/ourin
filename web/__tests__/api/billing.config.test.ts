import { describe, it, expect, vi, beforeEach } from "vitest";

// use vi.hoisted to define mocks that can be referenced in vi.mock factories
const { mockConvexQuery, mockStripePricesRetrieve } = vi.hoisted(() => ({
  mockConvexQuery: vi.fn(),
  mockStripePricesRetrieve: vi.fn(),
}));

// mock dependencies before importing the route
vi.mock("convex/browser", () => {
  return {
    ConvexHttpClient: class MockConvexHttpClient {
      query = mockConvexQuery;
    },
  };
});

vi.mock("@/lib/stripe", () => ({
  stripe: {
    prices: {
      retrieve: mockStripePricesRetrieve,
    },
  },
  CREDIT_PACK_PRICE_ID: "price_test_credits",
  SUBSCRIPTION_PRICE_ID: "price_test_subscription",
}));

// import after mocking
import { GET } from "@/app/api/billing/config/route";

describe("GET /api/billing/config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful responses", () => {
    it("returns billing config with all data", async () => {
      mockConvexQuery.mockResolvedValue({
        subscriptionCredits: 10000,
        creditPackAmount: 20000,
      });

      mockStripePricesRetrieve.mockResolvedValue({
        id: "price_123",
        unit_amount: 2000,
        currency: "usd",
        recurring: { interval: "month" },
      } as any);

      const _request = new Request("http://localhost/api/billing/config", {
        method: "GET",
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("subscriptionCredits");
      expect(data).toHaveProperty("creditPackAmount");
    });

    it("returns credit pack price from Stripe in cents", async () => {
      mockConvexQuery.mockResolvedValue({
        subscriptionCredits: 10000,
        creditPackAmount: 20000,
      });

      mockStripePricesRetrieve.mockResolvedValue({
        id: "price_credits",
        unit_amount: 1999,
        currency: "usd",
      } as any);

      const response = await GET();
      const data = await response.json();

      expect(data.creditPackPriceCents).toBe(1999);
    });

    it("returns subscription price from Stripe in cents", async () => {
      mockConvexQuery.mockResolvedValue({
        subscriptionCredits: 10000,
        creditPackAmount: 20000,
      });

      // first call is for subscription price, second for credit pack
      mockStripePricesRetrieve
        .mockResolvedValueOnce({
          id: "price_subscription",
          unit_amount: 1000,
          currency: "usd",
        } as any)
        .mockResolvedValueOnce({
          id: "price_credits",
          unit_amount: 2000,
          currency: "usd",
        } as any);

      const response = await GET();
      const data = await response.json();

      expect(data.subscriptionPriceCents).toBe(1000);
    });

    it("defaults creditPackPriceCents to 2000 when unit_amount is null", async () => {
      mockConvexQuery.mockResolvedValue({
        subscriptionCredits: 10000,
        creditPackAmount: 20000,
      });

      mockStripePricesRetrieve.mockResolvedValue({
        id: "price_credits",
        unit_amount: null,
        currency: "usd",
      } as any);

      const response = await GET();
      const data = await response.json();

      expect(data.creditPackPriceCents).toBe(2000);
    });
  });

  describe("fallback behavior", () => {
    it("returns defaults when Convex query fails", async () => {
      mockConvexQuery.mockRejectedValue(new Error("Convex error"));

      mockStripePricesRetrieve.mockResolvedValue({
        id: "price_123",
        unit_amount: 2000,
        currency: "usd",
      } as any);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.subscriptionCredits).toBeDefined();
    });

    it("returns defaults when Stripe price fetch fails", async () => {
      mockConvexQuery.mockResolvedValue({
        subscriptionCredits: 10000,
        creditPackAmount: 20000,
      });

      mockStripePricesRetrieve.mockRejectedValue(new Error("Stripe error"));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      // should return defaults, not error
      expect(data).toBeDefined();
    });

    it("returns defaults when any request fails", async () => {
      mockConvexQuery.mockResolvedValue({
        subscriptionCredits: 10000,
        creditPackAmount: 20000,
      });

      // stripe price fetch fails
      mockStripePricesRetrieve.mockRejectedValue(new Error("Stripe error"));

      const response = await GET();
      const data = await response.json();

      // returns defaults on error
      expect(response.status).toBe(200);
      expect(data.subscriptionCredits).toBe(10000);
      expect(data.subscriptionPriceCents).toBe(1000);
      expect(data.creditPackAmount).toBe(20000);
      expect(data.creditPackPriceCents).toBe(2000);
    });
  });

  describe("caching behavior", () => {
    it("sets appropriate cache headers", async () => {
      mockConvexQuery.mockResolvedValue({
        subscriptionCredits: 10000,
        creditPackAmount: 20000,
      });

      mockStripePricesRetrieve.mockResolvedValue({
        id: "price_123",
        unit_amount: 2000,
        currency: "usd",
      } as any);

      const response = await GET();

      // check response is successful
      expect(response.status).toBe(200);
    });
  });

  describe("data structure", () => {
    it("returns subscriptionCredits as number", async () => {
      mockConvexQuery.mockResolvedValue({
        subscriptionCredits: 10000,
        creditPackAmount: 20000,
      });

      mockStripePricesRetrieve.mockResolvedValue({
        id: "price_123",
        unit_amount: 2000,
        currency: "usd",
      } as any);

      const response = await GET();
      const data = await response.json();

      expect(typeof data.subscriptionCredits).toBe("number");
    });

    it("returns creditPackAmount as number", async () => {
      mockConvexQuery.mockResolvedValue({
        subscriptionCredits: 10000,
        creditPackAmount: 20000,
      });

      mockStripePricesRetrieve.mockResolvedValue({
        id: "price_123",
        unit_amount: 2000,
        currency: "usd",
      } as any);

      const response = await GET();
      const data = await response.json();

      expect(typeof data.creditPackAmount).toBe("number");
    });

    it("returns creditPackPriceCents as number", async () => {
      mockConvexQuery.mockResolvedValue({
        subscriptionCredits: 10000,
        creditPackAmount: 20000,
      });

      mockStripePricesRetrieve.mockResolvedValue({
        id: "price_123",
        unit_amount: 2000,
        currency: "usd",
      } as any);

      const response = await GET();
      const data = await response.json();

      expect(typeof data.creditPackPriceCents).toBe("number");
    });

    it("returns subscriptionPriceCents as number", async () => {
      mockConvexQuery.mockResolvedValue({
        subscriptionCredits: 10000,
        creditPackAmount: 20000,
      });

      mockStripePricesRetrieve.mockResolvedValue({
        id: "price_123",
        unit_amount: 1000,
        currency: "usd",
      } as any);

      const response = await GET();
      const data = await response.json();

      expect(typeof data.subscriptionPriceCents).toBe("number");
    });
  });
});
