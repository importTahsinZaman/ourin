import { describe, it, expect, vi, beforeEach } from "vitest";

// use vi.hoisted to define mocks that can be referenced in vi.mock factories
const { mockConvexQuery, mockPortalSessionsCreate } = vi.hoisted(() => ({
  mockConvexQuery: vi.fn(),
  mockPortalSessionsCreate: vi.fn(),
}));

// mock dependencies before importing the route
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
    billingPortal: {
      sessions: {
        create: mockPortalSessionsCreate,
      },
    },
  },
}));

import { verifyChatToken } from "@/lib/verifyChatToken";

// import after mocking
import { POST } from "@/app/api/stripe/portal/route";

describe("POST /api/stripe/portal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication", () => {
    it("returns 401 when no chatToken provided", async () => {
      const request = new Request("http://localhost/api/stripe/portal", {
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

      const request = new Request("http://localhost/api/stripe/portal", {
        method: "POST",
        body: JSON.stringify({ chatToken: "invalid_token" }),
      });

      const response = await POST(request);
      const _data = await response.json();

      expect(response.status).toBe(401);
    });

    it("returns 401 for anonymous user", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "anonymous",
      });

      const request = new Request("http://localhost/api/stripe/portal", {
        method: "POST",
        body: JSON.stringify({ chatToken: "anon_token" }),
      });

      const response = await POST(request);
      const _data = await response.json();

      expect(response.status).toBe(401);
    });
  });

  describe("subscription lookup", () => {
    it("returns 404 when no subscription exists", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_no_sub",
      });

      mockConvexQuery.mockResolvedValue(null);

      const request = new Request("http://localhost/api/stripe/portal", {
        method: "POST",
        body: JSON.stringify({ chatToken: "valid_token" }),
        headers: {
          origin: "http://localhost:3000",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain("subscription");
    });

    it("returns 404 when subscription has no stripeCustomerId", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_no_cust",
      });

      mockConvexQuery.mockResolvedValue({
        status: "active",
        stripeCustomerId: null,
      });

      const request = new Request("http://localhost/api/stripe/portal", {
        method: "POST",
        body: JSON.stringify({ chatToken: "valid_token" }),
        headers: {
          origin: "http://localhost:3000",
        },
      });

      const response = await POST(request);
      const _data = await response.json();

      expect(response.status).toBe(404);
    });
  });

  describe("portal session creation", () => {
    it("creates portal session with valid subscription", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_valid",
      });

      mockConvexQuery.mockResolvedValue({
        status: "active",
        stripeCustomerId: "cus_valid",
      });

      mockPortalSessionsCreate.mockResolvedValue({
        id: "bps_test",
        url: "https://billing.stripe.com/portal_123",
      } as any);

      const request = new Request("http://localhost/api/stripe/portal", {
        method: "POST",
        body: JSON.stringify({ chatToken: "valid_token" }),
        headers: {
          origin: "http://localhost:3000",
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it("uses stripeCustomerId from subscription", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_cust",
      });

      mockConvexQuery.mockResolvedValue({
        status: "active",
        stripeCustomerId: "cus_specific_123",
      });

      mockPortalSessionsCreate.mockResolvedValue({
        id: "bps_cust",
        url: "https://billing.stripe.com/portal_cust",
      } as any);

      const request = new Request("http://localhost/api/stripe/portal", {
        method: "POST",
        body: JSON.stringify({ chatToken: "valid_token" }),
        headers: {
          origin: "http://localhost:3000",
        },
      });

      await POST(request);

      expect(mockPortalSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: "cus_specific_123",
        })
      );
    });

    it("sets return_url with settings=billing query param", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_return",
      });

      mockConvexQuery.mockResolvedValue({
        status: "active",
        stripeCustomerId: "cus_return",
      });

      mockPortalSessionsCreate.mockResolvedValue({
        id: "bps_return",
        url: "https://billing.stripe.com/portal_return",
      } as any);

      const request = new Request("http://localhost/api/stripe/portal", {
        method: "POST",
        body: JSON.stringify({ chatToken: "valid_token" }),
        headers: {
          origin: "http://localhost:3000",
        },
      });

      await POST(request);

      expect(mockPortalSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          return_url: expect.stringContaining("?settings=billing"),
        })
      );
    });

    it("works for canceled subscription (still has customerId)", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_canceled",
      });

      mockConvexQuery.mockResolvedValue({
        status: "canceled",
        stripeCustomerId: "cus_canceled",
      });

      mockPortalSessionsCreate.mockResolvedValue({
        id: "bps_canceled",
        url: "https://billing.stripe.com/portal_canceled",
      } as any);

      const request = new Request("http://localhost/api/stripe/portal", {
        method: "POST",
        body: JSON.stringify({ chatToken: "valid_token" }),
        headers: {
          origin: "http://localhost:3000",
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
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

      mockPortalSessionsCreate.mockRejectedValue(new Error("Stripe API error"));

      const request = new Request("http://localhost/api/stripe/portal", {
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

      const request = new Request("http://localhost/api/stripe/portal", {
        method: "POST",
        body: JSON.stringify({ chatToken: "valid_token" }),
        headers: {
          origin: "http://localhost:3000",
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it("handles malformed JSON body", async () => {
      const request = new Request("http://localhost/api/stripe/portal", {
        method: "POST",
        body: "not valid json",
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });
  });

  describe("response format", () => {
    it("returns portal URL in response", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_url",
      });

      mockConvexQuery.mockResolvedValue({
        status: "active",
        stripeCustomerId: "cus_url",
      });

      const portalUrl = "https://billing.stripe.com/portal_url";
      mockPortalSessionsCreate.mockResolvedValue({
        id: "bps_url",
        url: portalUrl,
      } as any);

      const request = new Request("http://localhost/api/stripe/portal", {
        method: "POST",
        body: JSON.stringify({ chatToken: "valid_token" }),
        headers: {
          origin: "http://localhost:3000",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.url).toBe(portalUrl);
    });
  });
});
