import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock environment before importing
vi.stubEnv("EXPO_PUBLIC_API_URL", "https://api.test.com");

import { streamChat, ApiError, StreamEvent } from "@/lib/api";

describe("api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe("streamChat", () => {
    const mockOptions = {
      messages: [],
      conversationId: "conv-123",
      model: "gpt-4o",
    };

    /**
     * Helper to create a mock ReadableStream from SSE lines
     */
    function createMockStream(lines: string[]): ReadableStream<Uint8Array> {
      const encoder = new TextEncoder();
      let index = 0;

      return new ReadableStream({
        pull(controller) {
          if (index < lines.length) {
            controller.enqueue(encoder.encode(lines[index] + "\n"));
            index++;
          } else {
            controller.close();
          }
        },
      });
    }

    /**
     * Helper to create chunked stream (simulates network buffering)
     */
    function createChunkedStream(chunks: string[]): ReadableStream<Uint8Array> {
      const encoder = new TextEncoder();
      let index = 0;

      return new ReadableStream({
        pull(controller) {
          if (index < chunks.length) {
            controller.enqueue(encoder.encode(chunks[index]));
            index++;
          } else {
            controller.close();
          }
        },
      });
    }

    it("parses text-delta events and accumulates full text", async () => {
      const stream = createMockStream([
        'data:{"type":"text-delta","delta":"Hello"}',
        'data:{"type":"text-delta","delta":" world"}',
        'data:{"type":"text-delta","delta":"!"}',
      ]);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        body: stream,
      } as Response);

      const events: StreamEvent[] = [];
      const result = await streamChat("token", mockOptions, (e) =>
        events.push(e)
      );

      expect(result).toBe("Hello world!");
      expect(events.filter((e) => e.type === "text-delta")).toHaveLength(3);
      expect(events[events.length - 1].type).toBe("done");
    });

    it("handles reasoning events", async () => {
      const stream = createMockStream([
        'data:{"type":"reasoning-start","id":"r1"}',
        'data:{"type":"reasoning-delta","delta":"thinking..."}',
        'data:{"type":"reasoning-end","id":"r1"}',
        'data:{"type":"text-delta","delta":"Answer"}',
      ]);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        body: stream,
      } as Response);

      const events: StreamEvent[] = [];
      await streamChat("token", mockOptions, (e) => events.push(e));

      expect(events.map((e) => e.type)).toEqual([
        "reasoning-start",
        "reasoning-delta",
        "reasoning-end",
        "text-delta",
        "done",
      ]);
    });

    it("handles tool invocation events", async () => {
      const stream = createMockStream([
        'data:{"type":"tool-input-start","toolCallId":"t1","toolName":"web_search"}',
        'data:{"type":"tool-input-delta","delta":"query"}',
        'data:{"type":"tool-result","toolCallId":"t1","result":"results"}',
        'data:{"type":"text-delta","delta":"Based on search..."}',
      ]);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        body: stream,
      } as Response);

      const events: StreamEvent[] = [];
      await streamChat("token", mockOptions, (e) => events.push(e));

      expect(events.map((e) => e.type)).toEqual([
        "tool-input-start",
        "tool-input-delta",
        "tool-result",
        "text-delta",
        "done",
      ]);
    });

    it("handles sources events", async () => {
      const stream = createMockStream([
        'data:{"type":"text-delta","delta":"Here is info"}',
        'data:{"type":"sources","sources":[{"url":"https://example.com"}]}',
      ]);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        body: stream,
      } as Response);

      const events: StreamEvent[] = [];
      await streamChat("token", mockOptions, (e) => events.push(e));

      const sourcesEvent = events.find((e) => e.type === "sources");
      expect(sourcesEvent).toBeDefined();
      expect(sourcesEvent?.data).toEqual([{ url: "https://example.com" }]);
    });

    it("skips malformed JSON lines", async () => {
      const stream = createMockStream([
        'data:{"type":"text-delta","delta":"Hello"}',
        "data:{invalid json",
        'data:{"type":"text-delta","delta":" world"}',
      ]);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        body: stream,
      } as Response);

      const events: StreamEvent[] = [];
      const result = await streamChat("token", mockOptions, (e) =>
        events.push(e)
      );

      // Should skip the malformed line and continue
      expect(result).toBe("Hello world");
      expect(events.filter((e) => e.type === "text-delta")).toHaveLength(2);
    });

    it("skips lines without colon", async () => {
      const stream = createMockStream([
        'data:{"type":"text-delta","delta":"Hello"}',
        "no colon here",
        'data:{"type":"text-delta","delta":" world"}',
      ]);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        body: stream,
      } as Response);

      const events: StreamEvent[] = [];
      const result = await streamChat("token", mockOptions, (e) =>
        events.push(e)
      );

      expect(result).toBe("Hello world");
    });

    it("skips empty lines", async () => {
      const stream = createMockStream([
        'data:{"type":"text-delta","delta":"Hello"}',
        "",
        "   ",
        'data:{"type":"text-delta","delta":" world"}',
      ]);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        body: stream,
      } as Response);

      const events: StreamEvent[] = [];
      const result = await streamChat("token", mockOptions, (e) =>
        events.push(e)
      );

      expect(result).toBe("Hello world");
    });

    it("handles lines split across chunks (buffer handling)", async () => {
      // Simulate a line being split across two network chunks
      const stream = createChunkedStream([
        'data:{"type":"text-delta","del', // partial line
        'ta":"Hello"}\n', // rest of line
        'data:{"type":"text-delta","delta":" world"}\n',
      ]);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        body: stream,
      } as Response);

      const events: StreamEvent[] = [];
      const result = await streamChat("token", mockOptions, (e) =>
        events.push(e)
      );

      expect(result).toBe("Hello world");
      expect(events.filter((e) => e.type === "text-delta")).toHaveLength(2);
    });

    it("handles multiple lines in single chunk", async () => {
      const stream = createChunkedStream([
        'data:{"type":"text-delta","delta":"Hello"}\ndata:{"type":"text-delta","delta":" world"}\n',
      ]);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        body: stream,
      } as Response);

      const events: StreamEvent[] = [];
      const result = await streamChat("token", mockOptions, (e) =>
        events.push(e)
      );

      expect(result).toBe("Hello world");
    });

    it("handles data with multiple colons (JSON with colons)", async () => {
      const stream = createMockStream([
        'data:{"type":"text-delta","delta":"Time: 12:30"}',
      ]);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        body: stream,
      } as Response);

      const events: StreamEvent[] = [];
      const result = await streamChat("token", mockOptions, (e) =>
        events.push(e)
      );

      expect(result).toBe("Time: 12:30");
    });

    it("processes remaining buffer after stream ends", async () => {
      // Stream ends with data still in buffer (no trailing newline)
      const stream = createChunkedStream([
        'data:{"type":"text-delta","delta":"Hello"}\n',
        'data:{"type":"text-delta","delta":" world"}', // no trailing newline
      ]);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        body: stream,
      } as Response);

      const events: StreamEvent[] = [];
      const result = await streamChat("token", mockOptions, (e) =>
        events.push(e)
      );

      expect(result).toBe("Hello world");
    });

    it("throws ApiError on non-ok response with error code", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 403,
        json: () =>
          Promise.resolve({
            code: "MODEL_RESTRICTED",
            details: "Model not available for your tier",
          }),
      } as unknown as Response);

      await expect(
        streamChat("token", mockOptions, () => {})
      ).rejects.toMatchObject({
        status: 403,
        code: "MODEL_RESTRICTED",
        message: "Model not available for your tier",
      });
    });

    it("throws ApiError with UNKNOWN code when code missing", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: () =>
          Promise.resolve({
            error: "Internal server error",
          }),
      } as unknown as Response);

      await expect(
        streamChat("token", mockOptions, () => {})
      ).rejects.toMatchObject({
        status: 500,
        code: "UNKNOWN",
      });
    });

    it("handles JSON parse failure in error response", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("Invalid JSON")),
      } as unknown as Response);

      await expect(
        streamChat("token", mockOptions, () => {})
      ).rejects.toMatchObject({
        status: 500,
        message: "API error: 500",
      });
    });

    it("sends correct headers and body", async () => {
      const stream = createMockStream([]);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        body: stream,
      } as Response);

      await streamChat(
        "my-token",
        {
          messages: [{ role: "user", content: "Hello" }] as any,
          conversationId: "conv-123",
          model: "gpt-4o",
          systemPrompt: "Be helpful",
          reasoningLevel: "high",
          webSearchEnabled: true,
        },
        () => {}
      );

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.test.com/api/v1/chat",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer my-token",
          },
          body: expect.stringContaining('"model":"gpt-4o"'),
        })
      );

      const callArgs = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body).toMatchObject({
        conversationId: "conv-123",
        model: "gpt-4o",
        systemPrompt: "Be helpful",
        reasoningLevel: "high",
        webSearchEnabled: true,
      });
    });

    it("passes abort signal to fetch", async () => {
      const stream = createMockStream([]);
      const controller = new AbortController();

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        body: stream,
      } as Response);

      await streamChat("token", mockOptions, () => {}, controller.signal);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: controller.signal,
        })
      );
    });

    it("throws when response body is null", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        body: null,
      } as Response);

      await expect(streamChat("token", mockOptions, () => {})).rejects.toThrow(
        "No response body"
      );
    });
  });

  describe("ApiError", () => {
    it("creates error with all properties", () => {
      const error = new ApiError(
        "Test error",
        404,
        "NOT_FOUND",
        "Resource not found"
      );

      expect(error.message).toBe("Test error");
      expect(error.status).toBe(404);
      expect(error.code).toBe("NOT_FOUND");
      expect(error.details).toBe("Resource not found");
      expect(error.name).toBe("ApiError");
    });

    it("creates error without optional properties", () => {
      const error = new ApiError("Test error", 500);

      expect(error.message).toBe("Test error");
      expect(error.status).toBe(500);
      expect(error.code).toBeUndefined();
      expect(error.details).toBeUndefined();
    });
  });
});
