import { describe, it, expect, vi, beforeEach } from "vitest";

// mock dependencies
vi.mock("@/lib/verifyChatToken", () => ({
  verifyChatToken: vi.fn(),
  extractChatToken: vi.fn(() => null),
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn(() => "mock-anthropic-model"),
}));

import { verifyChatToken } from "@/lib/verifyChatToken";
import { generateText } from "ai";

// import after mocking
import { POST } from "@/app/api/chat/title/route";

describe("POST /api/chat/title", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication", () => {
    it("returns 401 when no chatToken provided", async () => {
      const request = new Request("http://localhost/api/chat/title", {
        method: "POST",
        body: JSON.stringify({
          userMessage: "Hello world",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("Unauthorized");
    });

    it("returns 401 for invalid token", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({ valid: false });

      const request = new Request("http://localhost/api/chat/title", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "invalid_token",
          userMessage: "Hello world",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("invalid");
    });
  });

  describe("input validation", () => {
    it("returns 400 when userMessage is missing", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({ valid: true });

      const request = new Request("http://localhost/api/chat/title", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "valid_token",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("required");
    });

    it("returns 400 when userMessage is not a string", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({ valid: true });

      const request = new Request("http://localhost/api/chat/title", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "valid_token",
          userMessage: 12345,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
    });

    it("returns 400 when userMessage is empty string", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({ valid: true });

      const request = new Request("http://localhost/api/chat/title", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "valid_token",
          userMessage: "",
        }),
      });

      const response = await POST(request);

      // empty string should be rejected
      expect(response.status).toBe(400);
    });
  });

  describe("title generation", () => {
    it("generates title from user message", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({ valid: true });
      vi.mocked(generateText).mockResolvedValue({
        text: "Python Debugging Help",
        finishReason: "stop",
      } as any);

      const request = new Request("http://localhost/api/chat/title", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "valid_token",
          userMessage: "How do I fix this Python error?",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.title).toBe("Python Debugging Help");
    });

    it("passes user message to generateText", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({ valid: true });
      vi.mocked(generateText).mockResolvedValue({
        text: "Test Title",
        finishReason: "stop",
      } as any);

      const request = new Request("http://localhost/api/chat/title", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "valid_token",
          userMessage: "My specific question about React",
        }),
      });

      await POST(request);

      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "My specific question about React",
        })
      );
    });

    it("uses Claude Haiku model", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({ valid: true });
      vi.mocked(generateText).mockResolvedValue({
        text: "Test Title",
        finishReason: "stop",
      } as any);

      const request = new Request("http://localhost/api/chat/title", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "valid_token",
          userMessage: "Test",
        }),
      });

      await POST(request);

      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "mock-anthropic-model",
        })
      );
    });

    it("limits max tokens", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({ valid: true });
      vi.mocked(generateText).mockResolvedValue({
        text: "Short Title",
        finishReason: "stop",
      } as any);

      const request = new Request("http://localhost/api/chat/title", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "valid_token",
          userMessage: "Test",
        }),
      });

      await POST(request);

      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          maxOutputTokens: 12,
        })
      );
    });
  });

  describe("title extraction/cleaning", () => {
    it("takes only first line of multi-line response", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({ valid: true });
      vi.mocked(generateText).mockResolvedValue({
        text: "First Line Title\nSecond line that should be ignored",
        finishReason: "stop",
      } as any);

      const request = new Request("http://localhost/api/chat/title", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "valid_token",
          userMessage: "Test",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.title).toBe("First Line Title");
    });

    it("removes markdown formatting", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({ valid: true });
      vi.mocked(generateText).mockResolvedValue({
        text: "**Bold Title** with _emphasis_",
        finishReason: "stop",
      } as any);

      const request = new Request("http://localhost/api/chat/title", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "valid_token",
          userMessage: "Test",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.title).not.toContain("**");
      expect(data.title).not.toContain("_");
    });

    it("removes surrounding quotes", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({ valid: true });
      vi.mocked(generateText).mockResolvedValue({
        text: '"Quoted Title"',
        finishReason: "stop",
      } as any);

      const request = new Request("http://localhost/api/chat/title", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "valid_token",
          userMessage: "Test",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.title).not.toMatch(/^["']/);
      expect(data.title).not.toMatch(/["']$/);
    });

    it("removes trailing punctuation except question mark", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({ valid: true });
      vi.mocked(generateText).mockResolvedValue({
        text: "Title with period.",
        finishReason: "stop",
      } as any);

      const request = new Request("http://localhost/api/chat/title", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "valid_token",
          userMessage: "Test",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.title).not.toMatch(/\.$/);
    });

    it("limits title to 5 words", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({ valid: true });
      vi.mocked(generateText).mockResolvedValue({
        text: "This is a very long title that has many words",
        finishReason: "stop",
      } as any);

      const request = new Request("http://localhost/api/chat/title", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "valid_token",
          userMessage: "Test",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      const wordCount = data.title.split(/\s+/).length;
      expect(wordCount).toBeLessThanOrEqual(5);
    });

    it("preserves question marks", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({ valid: true });
      vi.mocked(generateText).mockResolvedValue({
        text: "How to code?",
        finishReason: "stop",
      } as any);

      const request = new Request("http://localhost/api/chat/title", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "valid_token",
          userMessage: "How do I code?",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // question mark should be preserved since it's meaningful
      expect(data.title).toContain("?");
    });
  });

  describe("error handling", () => {
    it("returns 500 on generateText error", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({ valid: true });
      vi.mocked(generateText).mockRejectedValue(new Error("AI error"));

      const request = new Request("http://localhost/api/chat/title", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "valid_token",
          userMessage: "Test",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("Failed");
    });

    it("handles malformed JSON body", async () => {
      const request = new Request("http://localhost/api/chat/title", {
        method: "POST",
        body: "not valid json",
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });
  });

  describe("response format", () => {
    it("returns title in JSON format", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({ valid: true });
      vi.mocked(generateText).mockResolvedValue({
        text: "Test Title",
        finishReason: "stop",
      } as any);

      const request = new Request("http://localhost/api/chat/title", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "valid_token",
          userMessage: "Test",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data).toHaveProperty("title");
      expect(typeof data.title).toBe("string");
    });

    it("sets correct Content-Type header", async () => {
      vi.mocked(verifyChatToken).mockResolvedValue({ valid: true });
      vi.mocked(generateText).mockResolvedValue({
        text: "Test Title",
        finishReason: "stop",
      } as any);

      const request = new Request("http://localhost/api/chat/title", {
        method: "POST",
        body: JSON.stringify({
          chatToken: "valid_token",
          userMessage: "Test",
        }),
      });

      const response = await POST(request);

      expect(response.headers.get("Content-Type")).toContain(
        "application/json"
      );
    });
  });
});
