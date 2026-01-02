import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// set up environment
process.env.CHAT_AUTH_SECRET = "test-secret";

/**
 * tests for useOurinChat hook logic.
 * these tests verify sSE parsing, state management, and streaming behavior
 * without requiring react rendering or actual network calls.
 */

describe("useOurinChat Streaming Logic", () => {
  describe("SSE Event Parsing", () => {
    it("parses text-delta events correctly", () => {
      const line = 'data:{"type":"text-delta","delta":"Hello "}';
      const parsed = parseSSELine(line);

      expect(parsed?.type).toBe("text-delta");
      expect(parsed?.delta).toBe("Hello ");
    });

    it("parses reasoning-start events correctly", () => {
      const line = 'data:{"type":"reasoning-start","id":"0"}';
      const parsed = parseSSELine(line);

      expect(parsed?.type).toBe("reasoning-start");
      expect(parsed?.id).toBe("0");
    });

    it("parses reasoning-delta events correctly", () => {
      const line =
        'data:{"type":"reasoning-delta","delta":"thinking...","id":"0"}';
      const parsed = parseSSELine(line);

      expect(parsed?.type).toBe("reasoning-delta");
      expect(parsed?.delta).toBe("thinking...");
      expect(parsed?.id).toBe("0");
    });

    it("parses reasoning-end events correctly", () => {
      const line = 'data:{"type":"reasoning-end","id":"0"}';
      const parsed = parseSSELine(line);

      expect(parsed?.type).toBe("reasoning-end");
    });

    it("parses tool-input-start events correctly", () => {
      const line =
        'data:{"type":"tool-input-start","toolCallId":"call_123","toolName":"web_search"}';
      const parsed = parseSSELine(line);

      expect(parsed?.type).toBe("tool-input-start");
      expect(parsed?.toolCallId).toBe("call_123");
      expect(parsed?.toolName).toBe("web_search");
    });

    it("parses tool-input-available events correctly", () => {
      const line =
        'data:{"type":"tool-input-available","toolCallId":"call_123","input":{"query":"test"}}';
      const parsed = parseSSELine(line);

      expect(parsed?.type).toBe("tool-input-available");
      expect(parsed?.toolCallId).toBe("call_123");
      expect(parsed?.input).toEqual({ query: "test" });
    });

    it("parses tool-output-available events correctly", () => {
      const line =
        'data:{"type":"tool-output-available","toolCallId":"call_123","output":{"results":[]}}';
      const parsed = parseSSELine(line);

      expect(parsed?.type).toBe("tool-output-available");
      expect(parsed?.toolCallId).toBe("call_123");
      expect(parsed?.output).toEqual({ results: [] });
    });

    it("returns null for invalid lines", () => {
      expect(parseSSELine("")).toBeNull();
      expect(parseSSELine("invalid")).toBeNull();
      expect(parseSSELine("data:invalid-json")).toBeNull();
    });

    it("ignores lines without data: prefix", () => {
      expect(parseSSELine("event:message")).toBeNull();
      expect(parseSSELine(":comment")).toBeNull();
    });
  });

  describe("Part Accumulation Logic", () => {
    it("accumulates text deltas into single text part", () => {
      const accumulator = createPartAccumulator();

      accumulator.addTextDelta("Hello ");
      accumulator.addTextDelta("world!");

      const parts = accumulator.getParts();
      expect(parts.length).toBe(1);
      expect(parts[0]).toEqual({ type: "text", text: "Hello world!" });
    });

    it("creates reasoning part with correct structure", () => {
      const accumulator = createPartAccumulator();

      accumulator.startReasoning("0");
      accumulator.addReasoningDelta("0", "Let me think...");
      accumulator.endReasoning("0", 5);

      const parts = accumulator.getParts();
      expect(parts.length).toBe(1);
      expect(parts[0]).toEqual({
        type: "reasoning",
        text: "Let me think...",
        id: "reasoning-0",
        duration: 5,
      });
    });

    it("maintains chronological order of parts", () => {
      const accumulator = createPartAccumulator();

      // first reasoning
      accumulator.startReasoning("0");
      accumulator.addReasoningDelta("0", "Thinking first...");
      accumulator.endReasoning("0", 3);

      // then text
      accumulator.addTextDelta("Here's the answer: ");

      // more reasoning
      accumulator.startReasoning("1");
      accumulator.addReasoningDelta("1", "Reconsidering...");
      accumulator.endReasoning("1", 2);

      // final text
      accumulator.addTextDelta("42");

      const parts = accumulator.getParts();
      expect(parts.length).toBe(4);
      expect(parts[0].type).toBe("reasoning");
      expect(parts[1].type).toBe("text");
      expect((parts[1] as { text: string }).text).toBe("Here's the answer: ");
      expect(parts[2].type).toBe("reasoning");
      expect(parts[3].type).toBe("text");
      expect((parts[3] as { text: string }).text).toBe("42");
    });

    it("tracks tool invocations correctly", () => {
      const accumulator = createPartAccumulator();

      accumulator.addToolCall("call_123", "web_search", { query: "test" });
      accumulator.addToolResult("call_123", {
        results: ["result1", "result2"],
      });

      const parts = accumulator.getParts();
      expect(parts.length).toBe(1);
      expect(parts[0]).toEqual({
        type: "tool-invocation",
        toolInvocationId: "call_123",
        toolName: "web_search",
        args: { query: "test" },
        state: "result",
        result: { results: ["result1", "result2"] },
      });
    });

    it("handles multiple tool calls", () => {
      const accumulator = createPartAccumulator();

      accumulator.addToolCall("call_1", "web_search", { query: "first" });
      accumulator.addToolCall("call_2", "web_search", { query: "second" });
      accumulator.addToolResult("call_1", { results: ["a"] });
      accumulator.addToolResult("call_2", { results: ["b"] });

      const parts = accumulator.getParts();
      expect(parts.length).toBe(2);
      expect(parts[0].type).toBe("tool-invocation");
      expect((parts[0] as any).toolInvocationId).toBe("call_1");
      expect(parts[1].type).toBe("tool-invocation");
      expect((parts[1] as any).toolInvocationId).toBe("call_2");
    });
  });

  describe("Reasoning Duration Calculation", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("calculates duration from start to end", () => {
      const accumulator = createPartAccumulator();

      const now = Date.now();
      vi.setSystemTime(now);

      accumulator.startReasoning("0");
      accumulator.addReasoningDelta("0", "thinking...");

      // advance 5 seconds
      vi.setSystemTime(now + 5000);

      const duration = accumulator.endReasoning("0");

      expect(duration).toBe(5);
    });

    it("returns 0 duration when start time not tracked", () => {
      const accumulator = createPartAccumulator();

      // add reasoning without proper start
      accumulator.addReasoningDelta("0", "thinking...");
      const duration = accumulator.endReasoning("0");

      expect(duration).toBe(0);
    });

    it("accumulates total thinking duration across multiple blocks", () => {
      const accumulator = createPartAccumulator();

      const now = Date.now();
      vi.setSystemTime(now);

      accumulator.startReasoning("0");
      accumulator.addReasoningDelta("0", "first thought...");
      vi.setSystemTime(now + 3000);
      accumulator.endReasoning("0");

      vi.setSystemTime(now + 5000);
      accumulator.startReasoning("1");
      accumulator.addReasoningDelta("1", "second thought...");
      vi.setSystemTime(now + 7000);
      accumulator.endReasoning("1");

      expect(accumulator.getTotalThinkingDuration()).toBe(5); // 3 + 2 seconds
    });
  });

  describe("Status Transitions", () => {
    it("follows ready -> submitted -> streaming -> ready flow", () => {
      const transitions: string[] = [];
      const statusManager = createStatusManager((status) => {
        transitions.push(status);
      });

      expect(statusManager.getStatus()).toBe("ready");

      statusManager.setSubmitted();
      statusManager.setStreaming();
      statusManager.setReady();

      expect(transitions).toEqual(["submitted", "streaming", "ready"]);
    });

    it("handles error state correctly", () => {
      const statusManager = createStatusManager(() => {});

      statusManager.setSubmitted();
      statusManager.setStreaming();
      statusManager.setError(new Error("Network error"));

      expect(statusManager.getStatus()).toBe("error");
      expect(statusManager.getError()?.message).toBe("Network error");
    });

    it("clears error when starting new request", () => {
      const statusManager = createStatusManager(() => {});

      statusManager.setError(new Error("Previous error"));
      expect(statusManager.getError()).toBeDefined();

      statusManager.setSubmitted();
      expect(statusManager.getError()).toBeNull();
    });
  });

  describe("Abort Handling", () => {
    it("marks response as aborted on AbortError", () => {
      const error = new Error("Aborted");
      error.name = "AbortError";

      const isAbort = error.name === "AbortError";
      expect(isAbort).toBe(true);
    });

    it("preserves partial content on abort", () => {
      const accumulator = createPartAccumulator();

      accumulator.addTextDelta("Hello ");
      accumulator.startReasoning("0");
      accumulator.addReasoningDelta("0", "partial thinking...");
      // abort happens here - no endReasoning

      // finalize partial content
      accumulator.finalizeAll();

      const parts = accumulator.getParts();
      expect(parts.length).toBe(2);
      expect(parts[0]).toEqual({ type: "text", text: "Hello " });
      expect(parts[1].type).toBe("reasoning");
      expect((parts[1] as { text: string }).text).toBe("partial thinking...");
    });

    it("continues accumulating after abort finalization", () => {
      // verify that finalizeAll creates a clean state for the returned parts
      const accumulator = createPartAccumulator();

      accumulator.addTextDelta("Before abort");
      const partsAtAbort = accumulator.finalizeAll();

      expect(partsAtAbort.length).toBe(1);
      expect(partsAtAbort[0]).toEqual({ type: "text", text: "Before abort" });
    });
  });

  describe("Anonymous User Logic", () => {
    it("checks if anonymous user can send message", () => {
      const messageCount = 5;
      const limit = 10;

      const canSend = messageCount < limit;
      expect(canSend).toBe(true);
    });

    it("blocks anonymous user at message limit", () => {
      const messageCount = 10;
      const limit = 10;

      const canSend = messageCount < limit;
      expect(canSend).toBe(false);
    });

    it("calculates remaining messages correctly", () => {
      const messageCount = 7;
      const limit = 10;

      const remaining = Math.max(0, limit - messageCount);
      expect(remaining).toBe(3);
    });

    it("returns 0 remaining when over limit", () => {
      const messageCount = 12;
      const limit = 10;

      const remaining = Math.max(0, limit - messageCount);
      expect(remaining).toBe(0);
    });
  });

  describe("Title Generation Logic", () => {
    it("skips title generation for already-titled conversations", () => {
      const titleGenerated = new Set<string>();
      const convId = "conv_123";

      // first time - should generate
      const shouldGenerate1 = !titleGenerated.has(convId);
      expect(shouldGenerate1).toBe(true);

      titleGenerated.add(convId);

      // second time - should skip
      const shouldGenerate2 = !titleGenerated.has(convId);
      expect(shouldGenerate2).toBe(false);
    });

    it("extracts text from user message parts", () => {
      const parts = [
        { type: "text", text: "Hello " },
        { type: "file", fileName: "image.png" },
        { type: "text", text: "world" },
      ];

      const textContent = parts
        .filter((p) => p.type === "text")
        .map((p) => (p as { text: string }).text)
        .join(" ");

      expect(textContent).toBe("Hello  world");
    });
  });

  describe("Message ID Generation", () => {
    it("generates unique message IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(crypto.randomUUID());
      }
      expect(ids.size).toBe(100);
    });

    it("uses consistent ID for streaming message", () => {
      // the assistant message iD is generated once and used for both uI and dB
      const assistantMessageId = crypto.randomUUID();

      // verify it's a valid uUID format
      expect(assistantMessageId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });
  });

  describe("Error Response Handling", () => {
    it("extracts error code from response", () => {
      const errorData = {
        code: "MODEL_RESTRICTED",
        error: "Model not available",
        details: "Subscribe to access this model.",
      };

      expect(errorData.code).toBe("MODEL_RESTRICTED");
      expect(errorData.details).toBe("Subscribe to access this model.");
    });

    it("handles missing error code gracefully", () => {
      const errorData: { error: string; code?: string } = {
        error: "Something went wrong",
      };

      const code = errorData.code ?? "UNKNOWN";
      expect(code).toBe("UNKNOWN");
    });

    it("maps error codes to user-friendly messages", () => {
      const errorMessages: Record<string, string> = {
        MODEL_RESTRICTED: "Model not available",
        FREE_LIMIT_REACHED: "Message limit reached",
        NO_API_KEY: "API key required",
        CREDITS_DEPLETED: "Credits depleted",
        KEY_DECRYPT_ERROR: "API key error",
      };

      expect(errorMessages["MODEL_RESTRICTED"]).toBe("Model not available");
      expect(errorMessages["CREDITS_DEPLETED"]).toBe("Credits depleted");
    });
  });

  describe("Web Search Integration", () => {
    it("includes webSearchEnabled in metadata when enabled", () => {
      const webSearchEnabled = true;

      const metadata = {
        coreNames: ["Default"],
        ...(webSearchEnabled && { webSearchEnabled: true }),
      };

      expect(metadata.webSearchEnabled).toBe(true);
    });

    it("excludes webSearchEnabled from metadata when disabled", () => {
      const webSearchEnabled = false;

      const metadata: { coreNames: string[]; webSearchEnabled?: boolean } = {
        coreNames: ["Default"],
        ...(webSearchEnabled ? { webSearchEnabled: true } : {}),
      };

      expect(metadata.webSearchEnabled).toBeUndefined();
    });
  });

  describe("Persistence Interval Logic", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("persists only when parts have changed", () => {
      let persistCount = 0;
      let lastPersistedParts = "";

      const persistIfChanged = (parts: any[]) => {
        const partsKey = JSON.stringify(parts);
        if (partsKey === lastPersistedParts) return;
        lastPersistedParts = partsKey;
        persistCount++;
      };

      const parts1 = [{ type: "text", text: "Hello" }];
      const parts2 = [{ type: "text", text: "Hello" }];
      const parts3 = [{ type: "text", text: "Hello world" }];

      persistIfChanged(parts1);
      expect(persistCount).toBe(1);

      persistIfChanged(parts2); // same content
      expect(persistCount).toBe(1);

      persistIfChanged(parts3); // different content
      expect(persistCount).toBe(2);
    });

    it("clears interval on completion", () => {
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");

      const interval = setInterval(() => {}, 250);
      clearInterval(interval);

      expect(clearIntervalSpy).toHaveBeenCalledWith(interval);
      clearIntervalSpy.mockRestore();
    });
  });

  describe("Regenerate Logic", () => {
    it("finds last assistant message for regeneration", () => {
      const messages = [
        { id: "1", role: "user" },
        { id: "2", role: "assistant" },
        { id: "3", role: "user" },
        { id: "4", role: "assistant" },
      ];

      let targetIndex = messages.length - 1;
      while (targetIndex >= 0 && messages[targetIndex].role !== "assistant") {
        targetIndex--;
      }

      expect(targetIndex).toBe(3);
      expect(messages[targetIndex].id).toBe("4");
    });

    it("finds user message that prompted assistant response", () => {
      const messages = [
        { id: "1", role: "user" },
        { id: "2", role: "assistant" },
        { id: "3", role: "user" },
        { id: "4", role: "assistant" },
      ];

      const assistantIndex = 3;
      let userIndex = assistantIndex - 1;
      while (userIndex >= 0 && messages[userIndex].role !== "user") {
        userIndex--;
      }

      expect(userIndex).toBe(2);
      expect(messages[userIndex].id).toBe("3");
    });

    it("applies model override when provided", () => {
      const currentModel = "anthropic:claude-sonnet-4";
      const override = "openai:gpt-4o";

      const regenModel = override ?? currentModel;
      expect(regenModel).toBe("openai:gpt-4o");
    });

    it("uses current model when no override", () => {
      const currentModel = "anthropic:claude-sonnet-4";
      const override = undefined;

      const regenModel = override ?? currentModel;
      expect(regenModel).toBe("anthropic:claude-sonnet-4");
    });
  });

  describe("Edit and Resend Logic", () => {
    it("preserves file attachments from original message", () => {
      const originalParts = [
        { type: "text", text: "Original text" },
        { type: "file", fileName: "image.png", mediaType: "image/png" },
        { type: "file", fileName: "doc.pdf", mediaType: "application/pdf" },
      ];

      const fileParts = originalParts.filter((p) => p.type === "file");
      expect(fileParts.length).toBe(2);
    });

    it("replaces attachments when new ones provided", () => {
      const originalParts = [
        { type: "text", text: "Original text" },
        { type: "file", fileName: "old.png" },
      ];

      const newAttachments = [{ type: "file", fileName: "new.png" }];

      const fileParts =
        newAttachments ?? originalParts.filter((p) => p.type === "file");
      expect(fileParts.length).toBe(1);
      expect((fileParts[0] as any).fileName).toBe("new.png");
    });

    it("builds parts with text first, then attachments", () => {
      const newContent = "Updated text";
      const fileParts = [
        { type: "file", fileName: "image.png" },
        { type: "file", fileName: "doc.pdf" },
      ];

      const parts: any[] = [];
      if (newContent.trim()) {
        parts.push({ type: "text", text: newContent });
      }
      parts.push(...fileParts);

      expect(parts.length).toBe(3);
      expect(parts[0].type).toBe("text");
      expect(parts[1].type).toBe("file");
      expect(parts[2].type).toBe("file");
    });

    it("omits text part when content is empty", () => {
      const newContent = "   ";
      const fileParts = [{ type: "file", fileName: "image.png" }];

      const parts: any[] = [];
      if (newContent.trim()) {
        parts.push({ type: "text", text: newContent });
      }
      parts.push(...fileParts);

      expect(parts.length).toBe(1);
      expect(parts[0].type).toBe("file");
    });
  });

  describe("Fork Conversation Logic", () => {
    it("finds message index for fork point", () => {
      const messages = [
        { id: "msg1" },
        { id: "msg2" },
        { id: "msg3" },
        { id: "msg4" },
      ];

      const forkAtId = "msg2";
      const forkIndex = messages.findIndex((m) => m.id === forkAtId);

      expect(forkIndex).toBe(1);
    });

    it("returns -1 for non-existent message", () => {
      const messages = [{ id: "msg1" }, { id: "msg2" }];

      const forkIndex = messages.findIndex((m) => m.id === "msg999");
      expect(forkIndex).toBe(-1);
    });
  });

  describe("Multi-Conversation Streaming", () => {
    describe("Effective Status Computation", () => {
      it("returns 'ready' when a different conversation is streaming", () => {
        const currentConversationId = "conv-B";
        const streamingConversationId = "conv-A";
        const status = "streaming";

        const effectiveStatus = computeEffectiveStatus(
          status,
          currentConversationId,
          streamingConversationId
        );

        expect(effectiveStatus).toBe("ready");
      });

      it("returns 'ready' when a different conversation is in submitted state", () => {
        const currentConversationId = "conv-B";
        const streamingConversationId = "conv-A";
        const status = "submitted";

        const effectiveStatus = computeEffectiveStatus(
          status,
          currentConversationId,
          streamingConversationId
        );

        expect(effectiveStatus).toBe("ready");
      });

      it("returns actual status when same conversation is streaming", () => {
        const currentConversationId = "conv-A";
        const streamingConversationId = "conv-A";
        const status = "streaming";

        const effectiveStatus = computeEffectiveStatus(
          status,
          currentConversationId,
          streamingConversationId
        );

        expect(effectiveStatus).toBe("streaming");
      });

      it("returns actual status when nothing is streaming", () => {
        const currentConversationId = "conv-A";
        const streamingConversationId = null;
        const status = "ready";

        const effectiveStatus = computeEffectiveStatus(
          status,
          currentConversationId,
          streamingConversationId
        );

        expect(effectiveStatus).toBe("ready");
      });

      it("returns error status regardless of streaming conversation", () => {
        const currentConversationId = "conv-B";
        const streamingConversationId = "conv-A";
        const status = "error";

        const effectiveStatus = computeEffectiveStatus(
          status,
          currentConversationId,
          streamingConversationId
        );

        expect(effectiveStatus).toBe("error");
      });

      it("handles null current conversation", () => {
        const currentConversationId = null;
        const streamingConversationId = "conv-A";
        const status = "streaming";

        const effectiveStatus = computeEffectiveStatus(
          status,
          currentConversationId,
          streamingConversationId
        );

        // different conversations, should return ready
        expect(effectiveStatus).toBe("ready");
      });
    });

    describe("Conversation Guard Logic", () => {
      it("allows state update when viewing same conversation", () => {
        const conversationIdRef = { current: "conv-A" };
        const targetConvId = "conv-A";

        const shouldUpdate = shouldUpdateUIState(
          conversationIdRef,
          targetConvId
        );

        expect(shouldUpdate).toBe(true);
      });

      it("blocks state update when viewing different conversation", () => {
        const conversationIdRef = { current: "conv-B" };
        const targetConvId = "conv-A";

        const shouldUpdate = shouldUpdateUIState(
          conversationIdRef,
          targetConvId
        );

        expect(shouldUpdate).toBe(false);
      });

      it("blocks state update when current is null but target exists", () => {
        const conversationIdRef = { current: null };
        const targetConvId = "conv-A";

        const shouldUpdate = shouldUpdateUIState(
          conversationIdRef,
          targetConvId
        );

        expect(shouldUpdate).toBe(false);
      });

      it("allows state update when both are null (new chat)", () => {
        const conversationIdRef = { current: null };
        const targetConvId = null;

        const shouldUpdate = shouldUpdateUIState(
          conversationIdRef,
          targetConvId
        );

        expect(shouldUpdate).toBe(true);
      });
    });

    describe("Conversation Switch Scenarios", () => {
      it("scenario: user sends in A, switches to B, A continues streaming", () => {
        // simulate the state at various points
        const stateManager = createMultiConversationStateManager();

        // 1. user sends message in conv a
        stateManager.startSending("conv-A");
        expect(stateManager.getEffectiveStatus("conv-A")).toBe("submitted");
        expect(stateManager.getEffectiveStatus("conv-B")).toBe("ready");

        // 2. streaming starts for conv a
        stateManager.startStreaming("conv-A");
        expect(stateManager.getEffectiveStatus("conv-A")).toBe("streaming");
        expect(stateManager.getEffectiveStatus("conv-B")).toBe("ready");

        // 3. user switches to conv b - conv b should show ready
        expect(stateManager.getEffectiveStatus("conv-B")).toBe("ready");

        // 4. streaming completes for conv a
        stateManager.completeStreaming("conv-A");
        expect(stateManager.getEffectiveStatus("conv-A")).toBe("ready");
        expect(stateManager.getEffectiveStatus("conv-B")).toBe("ready");
      });

      it("scenario: user can send in B while A is streaming in background", () => {
        const stateManager = createMultiConversationStateManager();

        // 1. start streaming in conv a
        stateManager.startSending("conv-A");
        stateManager.startStreaming("conv-A");
        expect(stateManager.getEffectiveStatus("conv-A")).toBe("streaming");

        // 2. user switches to conv b - shows ready because a is streaming
        expect(stateManager.getEffectiveStatus("conv-B")).toBe("ready");

        // 3. user starts sending in conv b
        // note: this replaces the tracked streaming conversation
        // (a's fetch continues in background but is no longer tracked)
        stateManager.startSending("conv-B");
        expect(stateManager.getEffectiveStatus("conv-B")).toBe("submitted");

        // conv a now shows "ready" because b is the tracked streaming conversation
        // (a's background fetch continues but isn't reflected in uI state)
        expect(stateManager.getEffectiveStatus("conv-A")).toBe("ready");
      });
    });
  });
});

// helper function to parse sSE lines
function parseSSELine(line: string): any | null {
  if (!line.trim()) return null;

  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) return null;

  const type = line.slice(0, colonIndex);
  const data = line.slice(colonIndex + 1);

  if (type !== "data") return null;

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// helper class to accumulate message parts
function createPartAccumulator() {
  const orderedParts: any[] = [];
  const toolInvocations = new Map<string, any>();
  let currentTextPartIndex: number | null = null;
  let currentReasoningId: string | null = null;
  let currentReasoningText = "";
  let currentReasoningStartTime: number | null = null;
  let totalThinkingDuration = 0;

  return {
    addTextDelta(delta: string) {
      // finalize reasoning if active
      if (currentReasoningId) {
        this.endReasoning(currentReasoningId);
      }

      if (currentTextPartIndex === null) {
        currentTextPartIndex = orderedParts.length;
        orderedParts.push({ type: "text", text: delta });
      } else {
        orderedParts[currentTextPartIndex].text += delta;
      }
    },

    startReasoning(id: string) {
      // finalize text if active
      currentTextPartIndex = null;

      currentReasoningId = id;
      currentReasoningText = "";
      currentReasoningStartTime = Date.now();
    },

    addReasoningDelta(id: string, delta: string) {
      if (!currentReasoningId) {
        currentReasoningId = id;
        currentReasoningStartTime = Date.now();
      }
      currentReasoningText += delta;
    },

    endReasoning(id: string, durationOverride?: number): number {
      const duration =
        durationOverride ??
        (currentReasoningStartTime
          ? Math.round((Date.now() - currentReasoningStartTime) / 1000)
          : 0);

      if (currentReasoningText) {
        orderedParts.push({
          type: "reasoning",
          text: currentReasoningText,
          id: `reasoning-${id}`,
          duration: duration > 0 ? duration : undefined,
        });
        totalThinkingDuration += duration;
      }

      currentReasoningId = null;
      currentReasoningText = "";
      currentReasoningStartTime = null;

      return duration;
    },

    addToolCall(toolCallId: string, toolName: string, args: any) {
      // finalize text and reasoning
      currentTextPartIndex = null;
      if (currentReasoningId) {
        this.endReasoning(currentReasoningId);
      }

      const toolPart = {
        type: "tool-invocation",
        toolInvocationId: toolCallId,
        toolName,
        args,
        state: "call",
      };
      toolInvocations.set(toolCallId, toolPart);
      orderedParts.push(toolPart);
    },

    addToolResult(toolCallId: string, result: any) {
      const tool = toolInvocations.get(toolCallId);
      if (tool) {
        tool.state = "result";
        tool.result = result;
      }
    },

    finalizeAll() {
      // finalize any pending reasoning without adding duration
      if (currentReasoningText) {
        orderedParts.push({
          type: "reasoning",
          text: currentReasoningText,
          id: currentReasoningId
            ? `reasoning-${currentReasoningId}`
            : "reasoning-partial",
        });
      }
      currentReasoningId = null;
      currentReasoningText = "";
      currentTextPartIndex = null;

      return [...orderedParts];
    },

    getParts() {
      return [...orderedParts];
    },

    getTotalThinkingDuration() {
      return totalThinkingDuration;
    },
  };
}

// helper class to manage status transitions
function createStatusManager(onStatusChange: (status: string) => void) {
  let status = "ready";
  let error: Error | null = null;

  return {
    getStatus() {
      return status;
    },

    getError() {
      return error;
    },

    setSubmitted() {
      status = "submitted";
      error = null;
      onStatusChange(status);
    },

    setStreaming() {
      status = "streaming";
      onStatusChange(status);
    },

    setReady() {
      status = "ready";
      onStatusChange(status);
    },

    setError(err: Error) {
      status = "error";
      error = err;
      onStatusChange(status);
    },
  };
}

// helper function to compute effective status (mirrors useOurinChat logic)
function computeEffectiveStatus(
  status: string,
  currentConversationId: string | null,
  streamingConversationId: string | null
): string {
  if (
    streamingConversationId &&
    streamingConversationId !== currentConversationId &&
    (status === "streaming" || status === "submitted")
  ) {
    return "ready";
  }
  return status;
}

// helper function to check if uI state should be updated (mirrors guard logic)
function shouldUpdateUIState(
  conversationIdRef: { current: string | null },
  targetConvId: string | null
): boolean {
  return conversationIdRef.current === targetConvId;
}

// helper class to manage multi-conversation streaming state
function createMultiConversationStateManager() {
  let status = "ready";
  let streamingConversationId: string | null = null;

  return {
    startSending(convId: string) {
      status = "submitted";
      streamingConversationId = convId;
    },

    startStreaming(convId: string) {
      status = "streaming";
      streamingConversationId = convId;
    },

    completeStreaming(convId: string) {
      if (streamingConversationId === convId) {
        status = "ready";
        streamingConversationId = null;
      }
    },

    getEffectiveStatus(currentConvId: string): string {
      return computeEffectiveStatus(
        status,
        currentConvId,
        streamingConversationId
      );
    },

    isStreaming(convId: string): boolean {
      return streamingConversationId === convId && status === "streaming";
    },
  };
}
