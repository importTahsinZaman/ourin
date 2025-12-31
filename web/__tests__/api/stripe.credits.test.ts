import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted to define mocks that can be referenced in vi.mock factories
const { mockConvexQuery, mockCheckoutSessionsCreate } = vi.hoisted(() => ({
  mockConvexQuery: vi.fn(),
  mockCheckoutSessionsCreate: vi.fn(),
}));

// Mock dependencies before importing the route
vi.mock("@/lib/verifyChatToken", () => ({
  verifyChatToken: vi.fn(),
  extractChatToken: vi.fn(() => null),
}));

vi.mock("convex/browser", () => {
  return {
    ConvexHttpClient: class MockConvexHttpClient {
      query = mockConvexQuery;
    },
  };
});

vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: mockCheckoutSessionsCreate,
      },
    },
  },
  CREDIT_PACK_PRICE_ID: "price_test_credits",
}));

import { verifyChatToken } from "@/lib/verifyChatToken";

// Import after mocking
import { POST } from "@/app/api/stripe/buy-credits/route";

describe("POST /api/stripe/buy-credits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication", () => {
    it("returns 401 when no chatToken provided", async () => {
      const request = new Request("http://localhost/api/stripe/buy-credits", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("Unauthorized");
    });

    it("returns 401 for invalid token", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({ valid: false });

      const request = new Request("http://localhost/api/stripe/buy-credits", {
        method: "POST",
        body: JSON.stringify({ chatToken: "invalid_token" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
    });

    it("returns 401 for anonymous user", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "anonymous",
      });

      const request = new Request("http://localhost/api/stripe/buy-credits", {
        method: "POST",
        body: JSON.stringify({ chatToken: "anon_token" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
    });
  });

  describe("subscription requirement", () => {
    it("returns 400 when user has no subscription", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_no_sub",
      });

      mockConvexQuery.mockResolvedValue(null);

      const request = new Request("http://localhost/api/stripe/buy-credits", {
        method: "POST",
        body: JSON.stringify({ chatToken: "valid_token" }),
        headers: {
          origin: "http://localhost:3000",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain("subscription");
    });

    it("returns 400 when subscription is not active", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_inactive_sub",
      });

      mockConvexQuery.mockResolvedValue({
        status: "canceled",
        stripeCustomerId: "cus_123",
      });

      const request = new Request("http://localhost/api/stripe/buy-credits", {
        method: "POST",
        body: JSON.stringify({ chatToken: "valid_token" }),
        headers: {
          origin: "http://localhost:3000",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain("subscription");
    });
  });

  describe("checkout session creation", () => {
    it("creates checkout session for user with active subscription", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_active",
      });

      mockConvexQuery.mockResolvedValue({
        status: "active",
        stripeCustomerId: "cus_active",
      });

      mockCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_credits_123",
        url: "https://checkout.stripe.com/credits_123",
      } as any);

      const request = new Request("http://localhost/api/stripe/buy-credits", {
        method: "POST",
        body: JSON.stringify({ chatToken: "valid_token" }),
        headers: {
          origin: "http://localhost:3000",
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it("sets mode to payment (not subscription)", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_payment_mode",
      });

      mockConvexQuery.mockResolvedValue({
        status: "active",
        stripeCustomerId: "cus_payment_mode",
      });

      mockCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_credits_mode",
        url: "https://checkout.stripe.com/credits_mode",
      } as any);

      const request = new Request("http://localhost/api/stripe/buy-credits", {
        method: "POST",
        body: JSON.stringify({ chatToken: "valid_token" }),
        headers: {
          origin: "http://localhost:3000",
        },
      });

      await POST(request);

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "payment",
        })
      );
    });

    it("uses existing stripeCustomerId", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_cust_id",
      });

      mockConvexQuery.mockResolvedValue({
        status: "active",
        stripeCustomerId: "cus_existing_123",
      });

      mockCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_credits_cust",
        url: "https://checkout.stripe.com/credits_cust",
      } as any);

      const request = new Request("http://localhost/api/stripe/buy-credits", {
        method: "POST",
        body: JSON.stringify({ chatToken: "valid_token" }),
        headers: {
          origin: "http://localhost:3000",
        },
      });

      await POST(request);

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: "cus_existing_123",
        })
      );
    });

    it("includes credit_pack type in metadata", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_meta_type",
      });

      mockConvexQuery.mockResolvedValue({
        status: "active",
        stripeCustomerId: "cus_meta_type",
      });

      mockCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_credits_meta",
        url: "https://checkout.stripe.com/credits_meta",
      } as any);

      const request = new Request("http://localhost/api/stripe/buy-credits", {
        method: "POST",
        body: JSON.stringify({ chatToken: "valid_token" }),
        headers: {
          origin: "http://localhost:3000",
        },
      });

      await POST(request);

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            type: "credit_pack",
          }),
        })
      );
    });

    it("includes userId in metadata", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_credits_meta",
      });

      mockConvexQuery.mockResolvedValue({
        status: "active",
        stripeCustomerId: "cus_credits_meta",
      });

      mockCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_credits_user_meta",
        url: "https://checkout.stripe.com/credits_user_meta",
      } as any);

      const request = new Request("http://localhost/api/stripe/buy-credits", {
        method: "POST",
        body: JSON.stringify({ chatToken: "valid_token" }),
        headers: {
          origin: "http://localhost:3000",
        },
      });

      await POST(request);

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            userId: "user_credits_meta",
          }),
        })
      );
    });
  });

  describe("error handling", () => {
    it("returns 500 on Stripe API error", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_stripe_error",
      });

      mockConvexQuery.mockResolvedValue({
        status: "active",
        stripeCustomerId: "cus_stripe_error",
      });

      mockCheckoutSessionsCreate.mockRejectedValue(
        new Error("Stripe API error")
      );

      const request = new Request("http://localhost/api/stripe/buy-credits", {
        method: "POST",
        body: JSON.stringify({ chatToken: "valid_token" }),
        headers: {
          origin: "http://localhost:3000",
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it("returns 500 on Convex query error", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_convex_error",
      });

      mockConvexQuery.mockRejectedValue(new Error("Convex error"));

      const request = new Request("http://localhost/api/stripe/buy-credits", {
        method: "POST",
        body: JSON.stringify({ chatToken: "valid_token" }),
        headers: {
          origin: "http://localhost:3000",
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });
  });

  describe("response format", () => {
    it("returns checkout URL in response", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_url_response",
      });

      mockConvexQuery.mockResolvedValue({
        status: "active",
        stripeCustomerId: "cus_url_response",
      });

      const checkoutUrl = "https://checkout.stripe.com/credits_url";
      mockCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_credits_url",
        url: checkoutUrl,
      } as any);

      const request = new Request("http://localhost/api/stripe/buy-credits", {
        method: "POST",
        body: JSON.stringify({ chatToken: "valid_token" }),
        headers: {
          origin: "http://localhost:3000",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.url).toBe(checkoutUrl);
    });
  });
});
