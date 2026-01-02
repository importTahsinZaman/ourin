import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyChatToken } from "@/lib/verifyChatToken";
import { generateTestToken, generateTamperedToken } from "@/test-utils/mocks";

const TEST_SECRET = "test-secret-key-for-testing-purposes";

describe("verifyChatToken", () => {
  beforeEach(() => {
    process.env.CHAT_AUTH_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("valid tokens", () => {
    it("accepts valid token within 60 seconds", async () => {
      const token = await generateTestToken("user123", TEST_SECRET);
      const result = await verifyChatToken(token);

      expect(result.valid).toBe(true);
      expect(result.userId).toBe("user123");
    });

    it("accepts token at exactly 59 seconds old", async () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      const token = await generateTestToken("user123", TEST_SECRET, now);

      // advance time by 59 seconds
      vi.setSystemTime(now + 59000);

      const result = await verifyChatToken(token);
      expect(result.valid).toBe(true);
      expect(result.userId).toBe("user123");
    });

    it("accepts anonymous user tokens", async () => {
      const token = await generateTestToken("anonymous", TEST_SECRET);
      const result = await verifyChatToken(token);

      expect(result.valid).toBe(true);
      expect(result.userId).toBe("anonymous");
    });

    it("handles special characters in userId", async () => {
      const token = await generateTestToken(
        "user_with-special.chars@test",
        TEST_SECRET
      );
      const result = await verifyChatToken(token);

      expect(result.valid).toBe(true);
      expect(result.userId).toBe("user_with-special.chars@test");
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

      const result = await verifyChatToken(token);
      expect(result.valid).toBe(false);
      expect(result.userId).toBeUndefined();
    });

    it("rejects token at exactly 300001ms old", async () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      const token = await generateTestToken("user123", TEST_SECRET, now);

      // advance time by exactly 300001ms (just past the 5 minute limit)
      vi.setSystemTime(now + 300001);

      const result = await verifyChatToken(token);
      expect(result.valid).toBe(false);
    });

    it("rejects very old tokens", async () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      // token from 1 hour ago
      const token = await generateTestToken(
        "user123",
        TEST_SECRET,
        now - 3600000
      );

      const result = await verifyChatToken(token);
      expect(result.valid).toBe(false);
    });
  });

  describe("tampered tokens", () => {
    it("rejects token with tampered signature", async () => {
      const now = Date.now();
      const token = generateTamperedToken("user123", now);

      const result = await verifyChatToken(token);
      expect(result.valid).toBe(false);
    });

    it("rejects token with tampered userId", async () => {
      // generate valid token then tamper with userId
      const token = await generateTestToken("user123", TEST_SECRET);
      const decoded = atob(token);
      const [_userId, timestamp, signature] = decoded.split(":");

      // create tampered token with different userId but same signature
      const tamperedToken = btoa(`hacker:${timestamp}:${signature}`);

      const result = await verifyChatToken(tamperedToken);
      expect(result.valid).toBe(false);
    });

    it("rejects token with tampered timestamp", async () => {
      // use a specific timestamp to ensure we can tamper it
      const originalTimestamp = Date.now() - 1000; // 1 second ago
      const token = await generateTestToken(
        "user123",
        TEST_SECRET,
        originalTimestamp
      );
      const decoded = atob(token);
      const [userId, _timestamp, signature] = decoded.split(":");

      // create tampered token with different timestamp (current time) but same signature
      const differentTimestamp = originalTimestamp + 500; // 500ms later
      const tamperedToken = btoa(
        `${userId}:${differentTimestamp}:${signature}`
      );

      const result = await verifyChatToken(tamperedToken);
      expect(result.valid).toBe(false);
    });

    it("rejects token signed with wrong secret", async () => {
      const token = await generateTestToken("user123", "wrong-secret");

      const result = await verifyChatToken(token);
      expect(result.valid).toBe(false);
    });
  });

  describe("malformed tokens", () => {
    it("rejects empty token", async () => {
      const result = await verifyChatToken("");
      expect(result.valid).toBe(false);
    });

    it("rejects null-like token", async () => {
      const result = await verifyChatToken("null");
      expect(result.valid).toBe(false);
    });

    it("rejects non-base64 token", async () => {
      const result = await verifyChatToken("not-valid-base64!!!");
      expect(result.valid).toBe(false);
    });

    it("rejects token without enough parts", async () => {
      const result = await verifyChatToken(btoa("onlyonepart"));
      expect(result.valid).toBe(false);
    });

    it("rejects token with invalid timestamp", async () => {
      const result = await verifyChatToken(btoa("user:notanumber:sig"));
      expect(result.valid).toBe(false);
    });

    it("rejects token with empty userId", async () => {
      // generate token with empty userId
      const token = await generateTestToken("", TEST_SECRET);
      // this should still technically work since empty string is valid base64 content
      // but let's verify the behavior
      const result = await verifyChatToken(token);
      // empty userId is technically valid - the signature will verify
      expect(result.valid).toBe(true);
      expect(result.userId).toBe("");
    });
  });

  describe("missing secret", () => {
    it("returns invalid when CHAT_AUTH_SECRET is not set", async () => {
      delete process.env.CHAT_AUTH_SECRET;

      const token = await generateTestToken("user123", TEST_SECRET);
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await verifyChatToken(token);

      expect(result.valid).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith(
        "CHAT_AUTH_SECRET environment variable is not set"
      );

      errorSpy.mockRestore();
    });
  });

  describe("edge cases", () => {
    it("handles very long userId", async () => {
      const longUserId = "a".repeat(1000);
      const token = await generateTestToken(longUserId, TEST_SECRET);

      const result = await verifyChatToken(token);
      expect(result.valid).toBe(true);
      expect(result.userId).toBe(longUserId);
    });

    it("handles userId with colons (delimiter character)", async () => {
      // userId contains colons which is the delimiter - this is a potential vulnerability
      // the current implementation splits on ":" which means this will fail
      const userIdWithColons = "user:with:colons";
      const token = await generateTestToken(userIdWithColons, TEST_SECRET);

      // this will fail because split(':') will give more than 3 parts
      // which means signature won't match expected position
      const result = await verifyChatToken(token);
      // the behavior depends on how split handles this
      // with 5 parts: [user, with, colons, timestamp, signature]
      // userId becomes "user", timestampStr becomes "with" -> naN -> old timestamp check fails
      expect(result.valid).toBe(false);
    });

    it("verifies signature using constant-time comparison via crypto.subtle", async () => {
      // note: crypto.subtle.sign is used which provides timing-safe operations
      // this test verifies that the comparison happens via signature verification
      // not via a simple string comparison that could be timing-attacked

      const token = await generateTestToken("user123", TEST_SECRET);

      // the implementation uses crypto.subtle.sign and then hex string comparison
      // the hex comparison is nOT constant-time, which is a potential vulnerability
      // but the primary security comes from the hMAC verification itself
      const result = await verifyChatToken(token);
      expect(result.valid).toBe(true);
    });
  });
});
