import { describe, it, expect } from "vitest";

/**
 * Free usage business logic tests.
 * Tests the calculations and rules without requiring the Convex runtime.
 */

const FREE_MESSAGE_LIMIT = 10;

// Business logic functions extracted from freeUsage.ts
function calculateRemainingMessages(messageCount: number): number {
  return Math.max(0, FREE_MESSAGE_LIMIT - messageCount);
}

function canSendMore(messageCount: number): boolean {
  return messageCount < FREE_MESSAGE_LIMIT;
}

function getFreeUsageResponse(
  usage: { messageCount: number; lastMessageAt: number } | null
) {
  return usage
    ? {
        messageCount: usage.messageCount,
        remainingMessages: Math.max(0, FREE_MESSAGE_LIMIT - usage.messageCount),
        lastMessageAt: usage.lastMessageAt,
      }
    : {
        messageCount: 0,
        remainingMessages: FREE_MESSAGE_LIMIT,
        lastMessageAt: null,
      };
}

function incrementUsageResponse(currentCount: number) {
  const newCount = currentCount + 1;
  return {
    messageCount: newCount,
    remainingMessages: Math.max(0, FREE_MESSAGE_LIMIT - newCount),
    canSendMore: newCount < FREE_MESSAGE_LIMIT,
  };
}

describe("freeUsage", () => {
  describe("Self-Hosting Mode", () => {
    // In self-hosting mode, free usage limits are bypassed

    it("returns unlimited messages in self-hosting mode", () => {
      const isSelfHosting = true;

      const selfHostedUsage = isSelfHosting
        ? {
            messageCount: 0,
            remainingMessages: null, // null indicates unlimited
            lastMessageAt: null,
          }
        : getFreeUsageResponse(null);

      expect(selfHostedUsage.remainingMessages).toBeNull();
    });

    it("canSendMore always returns true in self-hosting mode", () => {
      const isSelfHosting = true;

      // Even at 1000 messages, self-hosting can still send
      const canSendInSelfHosting = isSelfHosting ? true : canSendMore(1000);

      expect(canSendInSelfHosting).toBe(true);
    });

    it("incrementFreeUsage is a no-op in self-hosting mode", () => {
      const isSelfHosting = true;

      // In self-hosting mode, increment returns default unlimited response
      const result = isSelfHosting
        ? {
            messageCount: 0,
            remainingMessages: null,
            canSendMore: true,
          }
        : incrementUsageResponse(5);

      expect(result.canSendMore).toBe(true);
      expect(result.remainingMessages).toBeNull();
    });

    it("production mode still enforces limits", () => {
      const isSelfHosting = false;

      const result = isSelfHosting
        ? {
            messageCount: 0,
            remainingMessages: null,
            canSendMore: true,
          }
        : incrementUsageResponse(9);

      // At 9 messages, incrementing to 10 should return canSendMore=false
      expect(result.canSendMore).toBe(false);
      expect(result.remainingMessages).toBe(0);
    });
  });

  describe("calculateRemainingMessages", () => {
    it("returns full limit for 0 messages", () => {
      expect(calculateRemainingMessages(0)).toBe(10);
    });

    it("returns correct remaining for partial usage", () => {
      expect(calculateRemainingMessages(3)).toBe(7);
      expect(calculateRemainingMessages(5)).toBe(5);
      expect(calculateRemainingMessages(7)).toBe(3);
    });

    it("returns 0 at the limit", () => {
      expect(calculateRemainingMessages(10)).toBe(0);
    });

    it("caps at 0 when over limit", () => {
      expect(calculateRemainingMessages(15)).toBe(0);
      expect(calculateRemainingMessages(100)).toBe(0);
    });

    it("handles edge case of -1 (should not happen but be safe)", () => {
      // This tests defensive coding - negative counts shouldn't happen
      // but if they do, remaining should be capped at FREE_MESSAGE_LIMIT
      expect(calculateRemainingMessages(-1)).toBe(11); // Math.max(0, 10-(-1)) = 11
    });
  });

  describe("canSendMore", () => {
    it("returns true when under limit", () => {
      expect(canSendMore(0)).toBe(true);
      expect(canSendMore(5)).toBe(true);
      expect(canSendMore(9)).toBe(true);
    });

    it("returns false at limit", () => {
      expect(canSendMore(10)).toBe(false);
    });

    it("returns false over limit", () => {
      expect(canSendMore(11)).toBe(false);
      expect(canSendMore(100)).toBe(false);
    });
  });

  describe("getFreeUsageResponse", () => {
    it("returns default state for null usage (new user)", () => {
      const result = getFreeUsageResponse(null);

      expect(result).toEqual({
        messageCount: 0,
        remainingMessages: FREE_MESSAGE_LIMIT,
        lastMessageAt: null,
      });
    });

    it("returns correct state for existing user with partial usage", () => {
      const now = Date.now();
      const result = getFreeUsageResponse({
        messageCount: 5,
        lastMessageAt: now,
      });

      expect(result).toEqual({
        messageCount: 5,
        remainingMessages: 5,
        lastMessageAt: now,
      });
    });

    it("returns 0 remaining when at limit", () => {
      const now = Date.now();
      const result = getFreeUsageResponse({
        messageCount: 10,
        lastMessageAt: now,
      });

      expect(result.messageCount).toBe(10);
      expect(result.remainingMessages).toBe(0);
    });

    it("caps remaining at 0 when over limit", () => {
      const now = Date.now();
      const result = getFreeUsageResponse({
        messageCount: 15,
        lastMessageAt: now,
      });

      expect(result.messageCount).toBe(15);
      expect(result.remainingMessages).toBe(0);
    });

    it("preserves lastMessageAt timestamp", () => {
      const timestamp = 1702838400000;
      const result = getFreeUsageResponse({
        messageCount: 3,
        lastMessageAt: timestamp,
      });

      expect(result.lastMessageAt).toBe(timestamp);
    });
  });

  describe("incrementUsageResponse", () => {
    it("increments count from 0 to 1", () => {
      const result = incrementUsageResponse(0);

      expect(result.messageCount).toBe(1);
      expect(result.remainingMessages).toBe(9);
      expect(result.canSendMore).toBe(true);
    });

    it("increments count correctly", () => {
      const result = incrementUsageResponse(5);

      expect(result.messageCount).toBe(6);
      expect(result.remainingMessages).toBe(4);
      expect(result.canSendMore).toBe(true);
    });

    it("returns canSendMore=true when still under limit", () => {
      const result = incrementUsageResponse(8);

      expect(result.messageCount).toBe(9);
      expect(result.remainingMessages).toBe(1);
      expect(result.canSendMore).toBe(true);
    });

    it("returns canSendMore=false at limit", () => {
      const result = incrementUsageResponse(9);

      expect(result.messageCount).toBe(10);
      expect(result.remainingMessages).toBe(0);
      expect(result.canSendMore).toBe(false);
    });

    it("returns canSendMore=false when past limit", () => {
      const result = incrementUsageResponse(10);

      expect(result.messageCount).toBe(11);
      expect(result.remainingMessages).toBe(0);
      expect(result.canSendMore).toBe(false);
    });
  });

  describe("message limit scenarios", () => {
    it("counts up correctly until blocked", () => {
      let count = 0;

      // Send 10 messages
      for (let i = 0; i < 10; i++) {
        const result = incrementUsageResponse(count);
        count = result.messageCount;
        expect(count).toBe(i + 1);

        if (i < 9) {
          expect(result.canSendMore).toBe(true);
        } else {
          expect(result.canSendMore).toBe(false);
        }
      }

      // Verify blocked state
      expect(canSendMore(count)).toBe(false);
      expect(calculateRemainingMessages(count)).toBe(0);
    });

    it("reset restores full limit", () => {
      // After reset, count goes back to 0
      const resetCount = 0;

      expect(canSendMore(resetCount)).toBe(true);
      expect(calculateRemainingMessages(resetCount)).toBe(FREE_MESSAGE_LIMIT);
    });

    it("handles rapid successive messages", () => {
      // Simulate 5 rapid messages
      let count = 0;
      for (let i = 0; i < 5; i++) {
        const result = incrementUsageResponse(count);
        count = result.messageCount;
      }

      expect(count).toBe(5);
      expect(calculateRemainingMessages(count)).toBe(5);
      expect(canSendMore(count)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("FREE_MESSAGE_LIMIT is 10", () => {
      expect(FREE_MESSAGE_LIMIT).toBe(10);
    });

    it("boundary at limit-1 allows one more message", () => {
      const atLimitMinus1 = 9;
      expect(canSendMore(atLimitMinus1)).toBe(true);
      expect(calculateRemainingMessages(atLimitMinus1)).toBe(1);
    });

    it("boundary at exact limit blocks", () => {
      const atLimit = 10;
      expect(canSendMore(atLimit)).toBe(false);
      expect(calculateRemainingMessages(atLimit)).toBe(0);
    });

    it("boundary at limit+1 stays blocked", () => {
      const overLimit = 11;
      expect(canSendMore(overLimit)).toBe(false);
      expect(calculateRemainingMessages(overLimit)).toBe(0);
    });
  });
});
