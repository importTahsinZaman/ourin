import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted to define mocks that can be referenced in vi.mock factories
const { mockConvexMutation } = vi.hoisted(() => ({
  mockConvexMutation: vi.fn(),
}));

// Mock dependencies before importing the route
vi.mock("@/lib/verifyChatToken", () => ({
  verifyChatToken: vi.fn(),
  extractChatToken: vi.fn(() => null),
}));

vi.mock("@/lib/encryption", () => ({
  encryptApiKey: vi.fn(),
  getKeyHint: vi.fn(),
  validateKeyFormat: vi.fn(),
}));

vi.mock("convex/browser", () => {
  return {
    ConvexHttpClient: class MockConvexHttpClient {
      mutation = mockConvexMutation;
    },
  };
});

import { verifyChatToken } from "@/lib/verifyChatToken";
import { encryptApiKey, getKeyHint, validateKeyFormat } from "@/lib/encryption";

// Import after mocking
import { POST } from "@/app/api/keys/save/route";

describe("POST /api/keys/save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication", () => {
    it("returns 401 when no chatToken provided", async () => {
      const request = new Request("http://localhost/api/keys/save", {
        method: "POST",
        body: JSON.stringify({
          provider: "anthropic",
          apiKey: "sk-ant-test",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("Unauthorized");
    });

    it("returns 401 for invalid token", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({ valid: false });

      const request = new Request("http://localhost/api/keys/save", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "invalid_token",
          provider: "anthropic",
          apiKey: "sk-ant-test",
        }),
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

      const request = new Request("http://localhost/api/keys/save", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "anon_token",
          provider: "anthropic",
          apiKey: "sk-ant-test",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("sign in");
    });

    it("returns 401 when userId is missing", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: undefined,
      });

      const request = new Request("http://localhost/api/keys/save", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "no_user_token",
          provider: "anthropic",
          apiKey: "sk-ant-test",
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });

  describe("input validation", () => {
    it("returns 400 when provider is missing", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_123",
      });

      const request = new Request("http://localhost/api/keys/save", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "valid_token",
          apiKey: "sk-ant-test",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Missing");
    });

    it("returns 400 when apiKey is missing", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_123",
      });

      const request = new Request("http://localhost/api/keys/save", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "valid_token",
          provider: "anthropic",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Missing");
    });

    it("returns 400 for invalid key format", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_123",
      });

      vi.mocked(validateKeyFormat).mockReturnValue(false);

      const request = new Request("http://localhost/api/keys/save", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "valid_token",
          provider: "anthropic",
          apiKey: "invalid-key-format",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid API key format");
    });
  });

  describe("key encryption", () => {
    it("encrypts the API key before saving", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_encrypt",
      });

      vi.mocked(validateKeyFormat).mockReturnValue(true);
      vi.mocked(encryptApiKey).mockResolvedValue("encrypted_key_data");
      vi.mocked(getKeyHint).mockReturnValue("sk-ant-...est");

      mockConvexMutation.mockResolvedValue(undefined);

      const request = new Request("http://localhost/api/keys/save", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "valid_token",
          provider: "anthropic",
          apiKey: "sk-ant-api123test",
        }),
      });

      await POST(request);

      expect(encryptApiKey).toHaveBeenCalledWith("sk-ant-api123test");
    });

    it("generates key hint for display", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_hint",
      });

      vi.mocked(validateKeyFormat).mockReturnValue(true);
      vi.mocked(encryptApiKey).mockResolvedValue("encrypted_data");
      vi.mocked(getKeyHint).mockReturnValue("sk-...xyz");

      mockConvexMutation.mockResolvedValue(undefined);

      const request = new Request("http://localhost/api/keys/save", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "valid_token",
          provider: "openai",
          apiKey: "sk-proj-abcdefghijklmnopqrstuvwxyz",
        }),
      });

      await POST(request);

      expect(getKeyHint).toHaveBeenCalledWith(
        "sk-proj-abcdefghijklmnopqrstuvwxyz"
      );
    });

    it("saves encrypted key and hint to Convex", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_save",
      });

      vi.mocked(validateKeyFormat).mockReturnValue(true);
      vi.mocked(encryptApiKey).mockResolvedValue("encrypted_key_123");
      vi.mocked(getKeyHint).mockReturnValue("sk-...abc");

      mockConvexMutation.mockResolvedValue(undefined);

      const request = new Request("http://localhost/api/keys/save", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "valid_token",
          provider: "anthropic",
          apiKey: "sk-ant-api123abc",
        }),
      });

      await POST(request);

      expect(mockConvexMutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: "user_save",
          provider: "anthropic",
          encryptedKey: "encrypted_key_123",
          keyHint: "sk-...abc",
        })
      );
    });
  });

  describe("provider handling", () => {
    it("validates Anthropic key format", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_anthropic",
      });

      vi.mocked(validateKeyFormat).mockReturnValue(true);
      vi.mocked(encryptApiKey).mockResolvedValue("encrypted");
      vi.mocked(getKeyHint).mockReturnValue("hint");
      mockConvexMutation.mockResolvedValue(undefined);

      const request = new Request("http://localhost/api/keys/save", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "valid_token",
          provider: "anthropic",
          apiKey: "sk-ant-test123",
        }),
      });

      await POST(request);

      expect(validateKeyFormat).toHaveBeenCalledWith(
        "anthropic",
        "sk-ant-test123"
      );
    });

    it("validates OpenAI key format", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_openai",
      });

      vi.mocked(validateKeyFormat).mockReturnValue(true);
      vi.mocked(encryptApiKey).mockResolvedValue("encrypted");
      vi.mocked(getKeyHint).mockReturnValue("hint");
      mockConvexMutation.mockResolvedValue(undefined);

      const request = new Request("http://localhost/api/keys/save", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "valid_token",
          provider: "openai",
          apiKey: "sk-proj-test123",
        }),
      });

      await POST(request);

      expect(validateKeyFormat).toHaveBeenCalledWith(
        "openai",
        "sk-proj-test123"
      );
    });

    it("validates Google key format", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_google",
      });

      vi.mocked(validateKeyFormat).mockReturnValue(true);
      vi.mocked(encryptApiKey).mockResolvedValue("encrypted");
      vi.mocked(getKeyHint).mockReturnValue("hint");
      mockConvexMutation.mockResolvedValue(undefined);

      const request = new Request("http://localhost/api/keys/save", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "valid_token",
          provider: "google",
          apiKey: "AIza-test-key",
        }),
      });

      await POST(request);

      expect(validateKeyFormat).toHaveBeenCalledWith("google", "AIza-test-key");
    });
  });

  describe("successful save", () => {
    it("returns success response", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_success",
      });

      vi.mocked(validateKeyFormat).mockReturnValue(true);
      vi.mocked(encryptApiKey).mockResolvedValue("encrypted");
      vi.mocked(getKeyHint).mockReturnValue("hint");
      mockConvexMutation.mockResolvedValue(undefined);

      const request = new Request("http://localhost/api/keys/save", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "valid_token",
          provider: "anthropic",
          apiKey: "sk-ant-test",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe("error handling", () => {
    it("returns 500 on encryption error", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_enc_error",
      });

      vi.mocked(validateKeyFormat).mockReturnValue(true);
      vi.mocked(encryptApiKey).mockRejectedValue(
        new Error("Encryption failed")
      );

      const request = new Request("http://localhost/api/keys/save", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "valid_token",
          provider: "anthropic",
          apiKey: "sk-ant-test",
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it("returns 500 on Convex mutation error", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({
        valid: true,
        userId: "user_convex_error",
      });

      vi.mocked(validateKeyFormat).mockReturnValue(true);
      vi.mocked(encryptApiKey).mockResolvedValue("encrypted");
      vi.mocked(getKeyHint).mockReturnValue("hint");
      mockConvexMutation.mockRejectedValue(new Error("Convex error"));

      const request = new Request("http://localhost/api/keys/save", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "valid_token",
          provider: "anthropic",
          apiKey: "sk-ant-test",
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it("handles malformed JSON body", async () => {
      const request = new Request("http://localhost/api/keys/save", {
        method: "POST",
        body: "not valid json",
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });
  });
});
