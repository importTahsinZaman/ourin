import { describe, it, expect, vi, beforeEach } from "vitest";

// use vi.hoisted to define mocks that can be referenced in vi.mock factories
const { mockCheckoutSessionsCreate } = vi.hoisted(() => ({
  mockCheckoutSessionsCreate: vi.fn(),
}));

// mock dependencies before importing the route
vi.mock("@/lib/verifyChatToken", () => ({
  verifyChatToken: vi.fn(),
  extractChatToken: vi.fn(() => null),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: mockCheckoutSessionsCreate,
      },
    },
  },
  SUBSCRIPTION_PRICE_ID: "price_test_subscription",
}));

import { verifyChatToken } from "@/lib/verifyChatToken";

// import after mocking
import { POST } from "@/app/api/stripe/checkout/route";

describe("POST /api/stripe/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication", () => {
    it("returns 401 when no chatToken provided", async () => {
      const request = new Request("http://localhost/api/stripe/checkout", {
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

      const request = new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ chatToken: "invalid_token" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("Unauthorized");
    });

    it("returns 401 for anonymous user", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "anonymous",
      });

      const request = new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ chatToken: "anon_token" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("sign in");
    });

    it("proceeds when userId is undefined but valid is true", async () => {
      // note: route doesn't explicitly check for undefined userId,
      // it only checks for "anonymous". empty userId will be used in metadata.
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: undefined,
      });

      mockCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_test_undefined",
        url: "https://checkout.stripe.com/session_undefined",
      } as any);

      const request = new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ chatToken: "no_user_token" }),
        headers: {
          origin: "http://localhost:3000",
        },
      });

      const response = await POST(request);

      // route proceeds with undefined userId (converted to empty string in metadata)
      expect(response.status).toBe(200);
    });
  });

  describe("checkout session creation", () => {
    it("creates checkout session with valid token", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_123",
      });

      mockCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_test_123",
        url: "https://checkout.stripe.com/session_123",
      } as any);

      const request = new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ chatToken: "valid_token" }),
        headers: {
          origin: "http://localhost:3000",
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it("includes userId in metadata", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_meta",
      });

      mockCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_test_meta",
        url: "https://checkout.stripe.com/session_meta",
      } as any);

      const request = new Request("http://localhost/api/stripe/checkout", {
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
            userId: "user_meta",
          }),
        })
      );
    });

    it("sets mode to subscription", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_mode",
      });

      mockCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_test_mode",
        url: "https://checkout.stripe.com/session_mode",
      } as any);

      const request = new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ chatToken: "valid_token" }),
        headers: {
          origin: "http://localhost:3000",
        },
      });

      await POST(request);

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "subscription",
        })
      );
    });
  });

  describe("success and cancel URLs", () => {
    it("sets success_url with billing settings query param", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_url",
      });

      mockCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_test_url",
        url: "https://checkout.stripe.com/session_url",
      } as any);

      const request = new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ chatToken: "valid_token" }),
        headers: {
          origin: "https://myapp.com",
        },
      });

      await POST(request);

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: expect.stringContaining(
            "?settings=billing&success=true"
          ),
        })
      );
    });

    it("sets cancel_url with billing settings query param", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_cancel",
      });

      mockCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_test_cancel",
        url: "https://checkout.stripe.com/session_cancel",
      } as any);

      const request = new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ chatToken: "valid_token" }),
        headers: {
          origin: "https://myapp.com",
        },
      });

      await POST(request);

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          cancel_url: expect.stringContaining(
            "?settings=billing&canceled=true"
          ),
        })
      );
    });
  });

  describe("error handling", () => {
    it("returns 500 on Stripe API error", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_error",
      });

      mockCheckoutSessionsCreate.mockRejectedValue(
        new Error("Stripe API error")
      );

      const request = new Request("http://localhost/api/stripe/checkout", {
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
      const request = new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: "not valid json",
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });
  });

  describe("response format", () => {
    it("returns checkout URL in response", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_response",
      });

      const checkoutUrl = "https://checkout.stripe.com/session_response";
      mockCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_test_response",
        url: checkoutUrl,
      } as any);

      const request = new Request("http://localhost/api/stripe/checkout", {
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

    it("does not expose session ID in response (only url)", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_session_id",
      });

      mockCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_test_session_id",
        url: "https://checkout.stripe.com/session",
      } as any);

      const request = new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ chatToken: "valid_token" }),
        headers: {
          origin: "http://localhost:3000",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      // route only returns url, not sessionId (security best practice)
      expect(data.url).toBeDefined();
      expect(data.sessionId).toBeUndefined();
    });
  });
});
