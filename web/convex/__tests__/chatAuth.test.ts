import { describe, it, expect, vi, afterEach } from "vitest";
import { verifyChatToken } from "../chatAuth";

const TEST_SECRET = "test-secret-key-for-testing-purposes";

/**
 * generate a valid chat token for testing.
 * uses the same algorithm as the production code.
 */
async function generateTestToken(
  userId: string,
  secret: string,
  timestamp?: number
): Promise<string> {
  const ts = timestamp ?? Date.now();
  const data = `${userId}:${ts}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return btoa(`${data}:${signatureHex}`);
}

describe("verifyChatToken (Convex export)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("valid tokens", () => {
    it("accepts valid token within 60 seconds", async () => {
      const token = await generateTestToken("user123", TEST_SECRET);
      const result = await verifyChatToken(token, TEST_SECRET);

      expect(result.valid).toBe(true);
      expect(result.userId).toBe("user123");
    });

    it("accepts token at boundary (59 seconds)", async () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      const token = await generateTestToken("user123", TEST_SECRET, now);

      // advance time by 59 seconds
      vi.setSystemTime(now + 59000);

      const result = await verifyChatToken(token, TEST_SECRET);
      expect(result.valid).toBe(true);
    });

    it("accepts anonymous tokens", async () => {
      const token = await generateTestToken("anonymous", TEST_SECRET);
      const result = await verifyChatToken(token, TEST_SECRET);

      expect(result.valid).toBe(true);
      expect(result.userId).toBe("anonymous");
    });
  });

  describe("expired tokens", () => {
    it("rejects token older than 5 minutes", async () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      const token = await generateTestToken("user123", TEST_SECRET, now);

      // advance time by 5 minutes and 1 second (300001ms)
      vi.setSystemTime(now + 300001);

      const result = await verifyChatToken(token, TEST_SECRET);
      expect(result.valid).toBe(false);
    });

    it("rejects token just past 5 minute boundary", async () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      const token = await generateTestToken("user123", TEST_SECRET, now);

      // advance time by exactly 300001ms (just past the 5 minute limit)
      vi.setSystemTime(now + 300001);

      const result = await verifyChatToken(token, TEST_SECRET);
      expect(result.valid).toBe(false);
    });
  });

  describe("invalid signatures", () => {
    it("rejects token with wrong secret", async () => {
      const token = await generateTestToken("user123", "wrong-secret");
      const result = await verifyChatToken(token, TEST_SECRET);
      expect(result.valid).toBe(false);
    });

    it("rejects tampered userId", async () => {
      const token = await generateTestToken("user123", TEST_SECRET);
      const decoded = atob(token);
      const [_userId, timestamp, signature] = decoded.split(":");

      const tamperedToken = btoa(`hacker:${timestamp}:${signature}`);
      const result = await verifyChatToken(tamperedToken, TEST_SECRET);
      expect(result.valid).toBe(false);
    });

    it("rejects tampered timestamp", async () => {
      const originalTime = Date.now() - 1000;
      const token = await generateTestToken(
        "user123",
        TEST_SECRET,
        originalTime
      );
      const decoded = atob(token);
      const [userId, _timestamp, signature] = decoded.split(":");

      const tamperedToken = btoa(
        `${userId}:${originalTime + 500}:${signature}`
      );
      const result = await verifyChatToken(tamperedToken, TEST_SECRET);
      expect(result.valid).toBe(false);
    });
  });

  describe("malformed tokens", () => {
    it("rejects empty token", async () => {
      const result = await verifyChatToken("", TEST_SECRET);
      expect(result.valid).toBe(false);
    });

    it("rejects invalid base64", async () => {
      const result = await verifyChatToken("not-valid-base64!!!", TEST_SECRET);
      expect(result.valid).toBe(false);
    });

    it("rejects token with missing parts", async () => {
      const result = await verifyChatToken(btoa("onlyonepart"), TEST_SECRET);
      expect(result.valid).toBe(false);
    });

    it("rejects token with non-numeric timestamp", async () => {
      const result = await verifyChatToken(
        btoa("user:notanumber:signature"),
        TEST_SECRET
      );
      expect(result.valid).toBe(false);
    });
  });

  describe("security properties", () => {
    it("signature is deterministic for same inputs", async () => {
      const timestamp = Date.now();
      const token1 = await generateTestToken("user123", TEST_SECRET, timestamp);
      const token2 = await generateTestToken("user123", TEST_SECRET, timestamp);

      expect(token1).toBe(token2);
    });

    it("signature differs with different timestamps", async () => {
      const token1 = await generateTestToken("user123", TEST_SECRET, 1000);
      const token2 = await generateTestToken("user123", TEST_SECRET, 1001);

      expect(token1).not.toBe(token2);
    });

    it("signature differs with different userIds", async () => {
      const timestamp = Date.now();
      const token1 = await generateTestToken("user123", TEST_SECRET, timestamp);
      const token2 = await generateTestToken("user456", TEST_SECRET, timestamp);

      expect(token1).not.toBe(token2);
    });

    it("signature differs with different secrets", async () => {
      const timestamp = Date.now();
      const token1 = await generateTestToken("user123", "secret1", timestamp);
      const token2 = await generateTestToken("user123", "secret2", timestamp);

      expect(token1).not.toBe(token2);
    });
  });
});
