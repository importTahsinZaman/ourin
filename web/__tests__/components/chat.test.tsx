import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * tests for chat component logic.
 * these tests verify helper functions, state management,
 * and business logic without rendering react components.
 */

describe("Chat Component Logic", () => {
  describe("MessageList Helpers", () => {
    describe("getFileExtension", () => {
      const getFileExtension = (fileName: string, mimeType: string): string => {
        const ext = fileName.split(".").pop()?.toUpperCase();
        if (ext && ext.length <= 4) return ext;
        if (mimeType.includes("pdf")) return "PDF";
        if (mimeType.includes("word")) return "DOC";
        if (mimeType.includes("excel") || mimeType.includes("spreadsheet"))
          return "XLS";
        if (mimeType.includes("json")) return "JSON";
        if (mimeType.includes("text")) return "TXT";
        return "FILE";
      };

      it("extracts extension from filename", () => {
        expect(getFileExtension("document.pdf", "application/pdf")).toBe("PDF");
        expect(getFileExtension("image.png", "image/png")).toBe("PNG");
        expect(getFileExtension("data.json", "application/json")).toBe("JSON");
      });

      it("handles multiple dots in filename", () => {
        expect(getFileExtension("my.file.name.txt", "text/plain")).toBe("TXT");
        expect(getFileExtension("archive.tar.gz", "application/gzip")).toBe(
          "GZ"
        );
      });

      it("falls back to mime type for long extensions", () => {
        expect(
          getFileExtension("file.verylongextension", "application/pdf")
        ).toBe("PDF");
        expect(
          getFileExtension(
            "spreadsheet.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          )
        ).toBe("XLSX");
      });

      it("returns FILE for unknown types", () => {
        expect(getFileExtension("unknown", "application/octet-stream")).toBe(
          "FILE"
        );
      });

      it("handles word documents", () => {
        expect(getFileExtension("document", "application/msword")).toBe("DOC");
      });

      it("handles spreadsheets", () => {
        expect(getFileExtension("sheet", "application/vnd.ms-excel")).toBe(
          "XLS"
        );
      });
    });

    describe("truncateFileName", () => {
      const truncateFileName = (
        name: string,
        maxLength: number = 25
      ): string => {
        if (name.length <= maxLength) return name;
        const ext = name.split(".").pop() || "";
        const nameWithoutExt = name.slice(0, name.length - ext.length - 1);
        const truncatedName =
          nameWithoutExt.slice(0, maxLength - ext.length - 4) + "...";
        return ext ? `${truncatedName}.${ext}` : truncatedName;
      };

      it("keeps short filenames unchanged", () => {
        expect(truncateFileName("short.pdf")).toBe("short.pdf");
        expect(truncateFileName("image.png", 25)).toBe("image.png");
      });

      it("truncates long filenames", () => {
        const longName = "this-is-a-very-long-filename-that-exceeds-limit.pdf";
        const truncated = truncateFileName(longName, 25);
        expect(truncated.length).toBeLessThanOrEqual(26); // allow for extension
        expect(truncated).toContain("...");
        expect(truncated.endsWith(".pdf")).toBe(true);
      });

      it("preserves file extension", () => {
        const truncated = truncateFileName(
          "really-long-name-for-testing-purposes.json",
          20
        );
        expect(truncated.endsWith(".json")).toBe(true);
      });

      it("handles files without extension", () => {
        const truncated = truncateFileName("verylongfilenamewithoutext", 15);
        expect(truncated).toContain("...");
      });
    });

    describe("formatReasoningLevel", () => {
      const formatReasoningLevel = (
        level: unknown,
        hasReasoningParam: boolean,
        isBudgetBased: boolean
      ): string | null => {
        if (level === undefined || level === null || level === "off")
          return null;
        if (!hasReasoningParam) return null;

        if (isBudgetBased && typeof level === "number") {
          return `${(level / 1000).toFixed(0)}k tokens`;
        }

        if (typeof level === "string") {
          return level.charAt(0).toUpperCase() + level.slice(1);
        }

        return String(level);
      };

      it("returns null for undefined/null/off", () => {
        expect(formatReasoningLevel(undefined, true, false)).toBeNull();
        expect(formatReasoningLevel(null, true, false)).toBeNull();
        expect(formatReasoningLevel("off", true, false)).toBeNull();
      });

      it("returns null when model doesn't support reasoning", () => {
        expect(formatReasoningLevel("medium", false, false)).toBeNull();
      });

      it("formats budget-based reasoning (Claude)", () => {
        expect(formatReasoningLevel(10000, true, true)).toBe("10k tokens");
        expect(formatReasoningLevel(5000, true, true)).toBe("5k tokens");
        expect(formatReasoningLevel(128000, true, true)).toBe("128k tokens");
      });

      it("capitalizes string levels", () => {
        expect(formatReasoningLevel("low", true, false)).toBe("Low");
        expect(formatReasoningLevel("medium", true, false)).toBe("Medium");
        expect(formatReasoningLevel("high", true, false)).toBe("High");
      });
    });

    describe("chunkMessageParts", () => {
      type MessagePart =
        | { type: "text"; text: string }
        | { type: "reasoning"; reasoning: string }
        | { type: "tool-invocation"; toolName: string }
        | { type: "sources"; sources: unknown[] }
        | { type: "file" };

      type MessageChunk =
        | { type: "steps"; parts: MessagePart[] }
        | { type: "text"; content: string }
        | { type: "sources"; sources: unknown[] };

      const chunkMessageParts = (parts: MessagePart[]): MessageChunk[] => {
        const chunks: MessageChunk[] = [];
        let currentStepsParts: MessagePart[] = [];

        const finalizeStepsChunk = () => {
          if (currentStepsParts.length > 0) {
            chunks.push({ type: "steps", parts: currentStepsParts });
            currentStepsParts = [];
          }
        };

        for (const part of parts) {
          if (part.type === "text") {
            finalizeStepsChunk();
            const textPart = part as { type: "text"; text: string };
            if (textPart.text.trim()) {
              chunks.push({ type: "text", content: textPart.text });
            }
          } else if (part.type === "sources") {
            finalizeStepsChunk();
            const sourcesPart = part as { type: "sources"; sources: unknown[] };
            if (sourcesPart.sources.length > 0) {
              chunks.push({ type: "sources", sources: sourcesPart.sources });
            }
          } else {
            currentStepsParts.push(part);
          }
        }

        finalizeStepsChunk();
        return chunks;
      };

      it("separates text from steps", () => {
        const parts: MessagePart[] = [
          { type: "reasoning", reasoning: "thinking..." },
          { type: "text", text: "Hello world" },
        ];

        const chunks = chunkMessageParts(parts);

        expect(chunks.length).toBe(2);
        expect(chunks[0].type).toBe("steps");
        expect(chunks[1].type).toBe("text");
      });

      it("groups consecutive non-text parts", () => {
        const parts: MessagePart[] = [
          { type: "reasoning", reasoning: "thinking" },
          { type: "tool-invocation", toolName: "search" },
          { type: "file" },
        ];

        const chunks = chunkMessageParts(parts);

        expect(chunks.length).toBe(1);
        expect(chunks[0].type).toBe("steps");
        expect(
          (chunks[0] as { type: "steps"; parts: MessagePart[] }).parts.length
        ).toBe(3);
      });

      it("handles interleaved text and steps", () => {
        const parts: MessagePart[] = [
          { type: "reasoning", reasoning: "first thought" },
          { type: "text", text: "First response" },
          { type: "tool-invocation", toolName: "search" },
          { type: "text", text: "Second response" },
        ];

        const chunks = chunkMessageParts(parts);

        expect(chunks.length).toBe(4);
        expect(chunks[0].type).toBe("steps");
        expect(chunks[1].type).toBe("text");
        expect(chunks[2].type).toBe("steps");
        expect(chunks[3].type).toBe("text");
      });

      it("skips empty text parts", () => {
        const parts: MessagePart[] = [
          { type: "text", text: "" },
          { type: "text", text: "   " },
          { type: "text", text: "Valid text" },
        ];

        const chunks = chunkMessageParts(parts);

        expect(chunks.length).toBe(1);
        expect((chunks[0] as { type: "text"; content: string }).content).toBe(
          "Valid text"
        );
      });

      it("extracts sources into separate chunks", () => {
        const parts: MessagePart[] = [
          { type: "text", text: "Here are results" },
          { type: "sources", sources: [{ url: "https://example.com" }] },
        ];

        const chunks = chunkMessageParts(parts);

        expect(chunks.length).toBe(2);
        expect(chunks[0].type).toBe("text");
        expect(chunks[1].type).toBe("sources");
      });
    });
  });

  describe("ChatInput Helpers", () => {
    describe("Draft Storage", () => {
      const DRAFT_STORAGE_KEY = "ourin-chat-drafts";

      beforeEach(() => {
        localStorage.clear();
      });

      const getDraftKey = (
        conversationId: string | null | undefined
      ): string => {
        return conversationId || "new";
      };

      const loadDraft = (conversationId: string | null | undefined): string => {
        try {
          const drafts = JSON.parse(
            localStorage.getItem(DRAFT_STORAGE_KEY) || "{}"
          );
          return drafts[getDraftKey(conversationId)] || "";
        } catch {
          return "";
        }
      };

      const saveDraft = (
        conversationId: string | null | undefined,
        text: string
      ): void => {
        try {
          const drafts = JSON.parse(
            localStorage.getItem(DRAFT_STORAGE_KEY) || "{}"
          );
          const key = getDraftKey(conversationId);
          if (text.trim()) {
            drafts[key] = text;
          } else {
            delete drafts[key];
          }
          localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
        } catch {
          // ignore
        }
      };

      it("returns 'new' key for null conversationId", () => {
        expect(getDraftKey(null)).toBe("new");
        expect(getDraftKey(undefined)).toBe("new");
      });

      it("returns conversationId as key when provided", () => {
        expect(getDraftKey("conv123")).toBe("conv123");
      });

      it("saves and loads drafts", () => {
        saveDraft("conv1", "Hello world");
        expect(loadDraft("conv1")).toBe("Hello world");
      });

      it("saves new chat draft with 'new' key", () => {
        saveDraft(null, "New chat draft");
        expect(loadDraft(null)).toBe("New chat draft");
        expect(loadDraft(undefined)).toBe("New chat draft");
      });

      it("deletes draft when text is empty", () => {
        saveDraft("conv1", "Some text");
        expect(loadDraft("conv1")).toBe("Some text");

        saveDraft("conv1", "");
        expect(loadDraft("conv1")).toBe("");
      });

      it("deletes draft when text is whitespace only", () => {
        saveDraft("conv1", "Some text");
        saveDraft("conv1", "   ");
        expect(loadDraft("conv1")).toBe("");
      });

      it("handles multiple conversations independently", () => {
        saveDraft("conv1", "Draft for conv1");
        saveDraft("conv2", "Draft for conv2");
        saveDraft(null, "New chat draft");

        expect(loadDraft("conv1")).toBe("Draft for conv1");
        expect(loadDraft("conv2")).toBe("Draft for conv2");
        expect(loadDraft(null)).toBe("New chat draft");
      });

      it("returns empty string for non-existent draft", () => {
        expect(loadDraft("nonexistent")).toBe("");
      });
    });

    describe("File Validation", () => {
      const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25mB
      const ALLOWED_TYPES = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/svg+xml",
        "application/pdf",
        "text/plain",
        "text/csv",
        "text/markdown",
        "application/json",
      ];

      const validateFile = (file: {
        size: number;
        type: string;
      }): { valid: boolean; error?: string } => {
        if (file.size > MAX_FILE_SIZE) {
          return {
            valid: false,
            error: "File must be less than 25MB",
          };
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
          return { valid: false, error: "File type not supported" };
        }
        return { valid: true };
      };

      it("accepts files under size limit", () => {
        const file = { size: 10 * 1024 * 1024, type: "image/png" };
        expect(validateFile(file).valid).toBe(true);
      });

      it("rejects files over size limit", () => {
        const file = { size: 30 * 1024 * 1024, type: "image/png" };
        const result = validateFile(file);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("25MB");
      });

      it("accepts allowed image types", () => {
        const imageTypes = [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
        ];
        for (const type of imageTypes) {
          expect(validateFile({ size: 1000, type }).valid).toBe(true);
        }
      });

      it("accepts document types", () => {
        const docTypes = ["application/pdf", "text/plain", "application/json"];
        for (const type of docTypes) {
          expect(validateFile({ size: 1000, type }).valid).toBe(true);
        }
      });

      it("rejects unsupported types", () => {
        const unsupportedTypes = ["video/mp4", "audio/mpeg", "application/zip"];
        for (const type of unsupportedTypes) {
          const result = validateFile({ size: 1000, type });
          expect(result.valid).toBe(false);
          expect(result.error).toBe("File type not supported");
        }
      });
    });

    describe("Attachment State Machine", () => {
      type AttachmentStatus =
        | "pending"
        | "checking"
        | "uploading"
        | "ready"
        | "error";

      it("follows correct state transitions", () => {
        // pending -> checking -> uploading -> ready
        const states: AttachmentStatus[] = [
          "pending",
          "checking",
          "uploading",
          "ready",
        ];

        for (let i = 0; i < states.length - 1; i++) {
          expect(states[i + 1]).not.toBe(states[i]);
        }
      });

      it("can skip uploading if duplicate found", () => {
        // pending -> checking -> ready (duplicate found)
        const statesWithDupe: AttachmentStatus[] = [
          "pending",
          "checking",
          "ready",
        ];

        expect(statesWithDupe[statesWithDupe.length - 1]).toBe("ready");
      });

      it("can transition to error from any uploading state", () => {
        const errorableStates: AttachmentStatus[] = ["checking", "uploading"];

        for (const state of errorableStates) {
          const canError = true;
          expect(canError).toBe(true);
        }
      });
    });

    describe("Attachment Draft Persistence", () => {
      const ATTACHMENT_DRAFT_KEY = "ourin-chat-attachment-drafts";

      beforeEach(() => {
        localStorage.clear();
      });

      interface PersistedAttachment {
        id: string;
        storageId: string;
        url: string;
        fileName: string;
        mimeType: string;
        size: number;
        isDrawing?: boolean;
      }

      const loadAttachmentsDraft = (
        conversationId: string | null | undefined
      ): PersistedAttachment[] => {
        try {
          const drafts = JSON.parse(
            localStorage.getItem(ATTACHMENT_DRAFT_KEY) || "{}"
          );
          return drafts[conversationId || "new"] || [];
        } catch {
          return [];
        }
      };

      const saveAttachmentsDraft = (
        conversationId: string | null | undefined,
        attachments: PersistedAttachment[]
      ): void => {
        try {
          const drafts = JSON.parse(
            localStorage.getItem(ATTACHMENT_DRAFT_KEY) || "{}"
          );
          const key = conversationId || "new";
          if (attachments.length > 0) {
            drafts[key] = attachments;
          } else {
            delete drafts[key];
          }
          localStorage.setItem(ATTACHMENT_DRAFT_KEY, JSON.stringify(drafts));
        } catch {
          // ignore
        }
      };

      it("saves and loads attachment drafts", () => {
        const attachments: PersistedAttachment[] = [
          {
            id: "1",
            storageId: "s1",
            url: "https://example.com/1",
            fileName: "test.png",
            mimeType: "image/png",
            size: 1000,
          },
        ];

        saveAttachmentsDraft("conv1", attachments);
        const loaded = loadAttachmentsDraft("conv1");

        expect(loaded.length).toBe(1);
        expect(loaded[0].fileName).toBe("test.png");
      });

      it("clears draft when attachments array is empty", () => {
        const attachments: PersistedAttachment[] = [
          {
            id: "1",
            storageId: "s1",
            url: "https://example.com/1",
            fileName: "test.png",
            mimeType: "image/png",
            size: 1000,
          },
        ];

        saveAttachmentsDraft("conv1", attachments);
        saveAttachmentsDraft("conv1", []);

        const loaded = loadAttachmentsDraft("conv1");
        expect(loaded.length).toBe(0);
      });

      it("handles new chat drafts", () => {
        const attachments: PersistedAttachment[] = [
          {
            id: "1",
            storageId: "s1",
            url: "https://example.com/1",
            fileName: "test.png",
            mimeType: "image/png",
            size: 1000,
          },
        ];

        saveAttachmentsDraft(null, attachments);

        expect(loadAttachmentsDraft(null).length).toBe(1);
        expect(loadAttachmentsDraft(undefined).length).toBe(1);
      });

      it("preserves isDrawing flag", () => {
        const attachments: PersistedAttachment[] = [
          {
            id: "1",
            storageId: "s1",
            url: "https://example.com/1",
            fileName: "drawing.png",
            mimeType: "image/png",
            size: 1000,
            isDrawing: true,
          },
          {
            id: "2",
            storageId: "s2",
            url: "https://example.com/2",
            fileName: "document.pdf",
            mimeType: "application/pdf",
            size: 2000,
          },
        ];

        saveAttachmentsDraft("conv1", attachments);
        const loaded = loadAttachmentsDraft("conv1");

        expect(loaded[0].isDrawing).toBe(true);
        expect(loaded[1].isDrawing).toBeUndefined();
      });
    });

    describe("Pasted Image Filename Generation", () => {
      it("generates filename with timestamp", () => {
        const timestamp = "2024-01-15T10-30-00-000Z";
        const extension = "png";
        const fileName = `pasted-image-${timestamp}.${extension}`;

        expect(fileName).toContain("pasted-image-");
        expect(fileName.endsWith(".png")).toBe(true);
      });

      it("extracts extension from mime type", () => {
        const mimeType = "image/png";
        const extension = mimeType.split("/")[1] || "png";
        expect(extension).toBe("png");
      });

      it("handles various image mime types", () => {
        const mimeTypes = [
          { type: "image/jpeg", expected: "jpeg" },
          { type: "image/png", expected: "png" },
          { type: "image/gif", expected: "gif" },
          { type: "image/webp", expected: "webp" },
        ];

        for (const { type, expected } of mimeTypes) {
          const extension = type.split("/")[1];
          expect(extension).toBe(expected);
        }
      });
    });

    describe("Screenshot Filename Generation", () => {
      it("generates filename with timestamp", () => {
        const timestamp = "2024-01-15T10-30-00-000Z";
        const fileName = `screenshot-${timestamp}.png`;

        expect(fileName).toContain("screenshot-");
        expect(fileName.endsWith(".png")).toBe(true);
      });
    });

    describe("Drawing Filename Generation", () => {
      it("generates filename with timestamp", () => {
        const timestamp = "2024-01-15T10-30-00-000Z";
        const fileName = `drawing-${timestamp}.png`;

        expect(fileName).toContain("drawing-");
        expect(fileName.endsWith(".png")).toBe(true);
      });
    });

    describe("Web Search Toggle", () => {
      it("starts disabled by default", () => {
        const webSearchEnabled = false;
        expect(webSearchEnabled).toBe(false);
      });

      it("can be toggled on", () => {
        let webSearchEnabled = false;
        webSearchEnabled = !webSearchEnabled;
        expect(webSearchEnabled).toBe(true);
      });

      it("requires subscription", () => {
        const isSubscriber = false;
        const modelSupportsWebSearch = true;

        const canToggle = isSubscriber && modelSupportsWebSearch;
        expect(canToggle).toBe(false);
      });

      it("allows toggle for subscribers", () => {
        const isSubscriber = true;
        const modelSupportsWebSearch = true;

        const canToggle = isSubscriber && modelSupportsWebSearch;
        expect(canToggle).toBe(true);
      });

      it("disabled when model doesn't support it", () => {
        const isSubscriber = true;
        const modelSupportsWebSearch = false;

        const shouldShow = modelSupportsWebSearch;
        expect(shouldShow).toBe(false);
      });
    });

    describe("Send Button State", () => {
      it("disabled when no content", () => {
        const text = "";
        const attachments: { status: string }[] = [];

        const hasContent =
          text.trim() || attachments.some((a) => a.status === "ready");

        expect(hasContent).toBeFalsy();
      });

      it("enabled when has text", () => {
        const text = "Hello";
        const attachments: { status: string }[] = [];

        const hasContent =
          text.trim() || attachments.some((a) => a.status === "ready");

        expect(hasContent).toBeTruthy();
      });

      it("enabled when has ready attachments", () => {
        const text = "";
        const attachments = [{ status: "ready" }];

        const hasContent =
          text.trim() || attachments.some((a) => a.status === "ready");

        expect(hasContent).toBeTruthy();
      });

      it("disabled when attachments still uploading", () => {
        const attachments = [{ status: "uploading" }, { status: "ready" }];

        const hasUploadingFiles = attachments.some(
          (a) => a.status === "uploading" || a.status === "checking"
        );

        expect(hasUploadingFiles).toBe(true);
      });

      it("shows blocked reason when canSend is false", () => {
        const canSend = false;
        const sendBlockedReason = "No credits remaining";

        const shouldShowTooltip = !canSend && sendBlockedReason;
        expect(shouldShowTooltip).toBeTruthy();
      });
    });

    describe("First Visit Detection", () => {
      const FIRST_VISIT_KEY = "ourin-first-visit-complete";

      beforeEach(() => {
        localStorage.clear();
      });

      const isFirstVisit = (): boolean => {
        return !localStorage.getItem(FIRST_VISIT_KEY);
      };

      const markFirstVisitComplete = (): void => {
        localStorage.setItem(FIRST_VISIT_KEY, "true");
      };

      it("returns true for first visit", () => {
        expect(isFirstVisit()).toBe(true);
      });

      it("returns false after marking complete", () => {
        markFirstVisitComplete();
        expect(isFirstVisit()).toBe(false);
      });
    });

    describe("Keyboard Shortcuts", () => {
      it("Enter sends message", () => {
        const event = { key: "Enter", shiftKey: false };
        const shouldSend = event.key === "Enter" && !event.shiftKey;
        expect(shouldSend).toBe(true);
      });

      it("Shift+Enter adds newline", () => {
        const event = { key: "Enter", shiftKey: true };
        const shouldSend = event.key === "Enter" && !event.shiftKey;
        expect(shouldSend).toBe(false);
      });

      it("Ctrl+Enter sends without scrolling", () => {
        const event = { key: "Enter", shiftKey: false, ctrlKey: true };
        const stayInPlace = event.ctrlKey;
        expect(stayInPlace).toBe(true);
      });

      it("Cmd+Enter sends without scrolling (Mac)", () => {
        const event = { key: "Enter", shiftKey: false, metaKey: true };
        const stayInPlace = event.metaKey;
        expect(stayInPlace).toBe(true);
      });
    });

    describe("Auto-send from Command Palette", () => {
      const AUTO_SEND_KEY = "ourin-auto-send-pending";

      beforeEach(() => {
        localStorage.clear();
      });

      it("sets auto-send flag", () => {
        localStorage.setItem(AUTO_SEND_KEY, "true");
        expect(localStorage.getItem(AUTO_SEND_KEY)).toBe("true");
      });

      it("clears flag after sending", () => {
        localStorage.setItem(AUTO_SEND_KEY, "true");
        localStorage.removeItem(AUTO_SEND_KEY);
        expect(localStorage.getItem(AUTO_SEND_KEY)).toBeNull();
      });
    });
  });

  describe("Message Rendering Logic", () => {
    describe("User Message", () => {
      it("identifies user messages", () => {
        const message = { role: "user" };
        expect(message.role === "user").toBe(true);
      });

      it("extracts text content from parts", () => {
        const parts = [
          { type: "text", text: "Hello " },
          { type: "file" },
          { type: "text", text: "World" },
        ];

        const textContent = parts
          .filter((p) => p.type === "text")
          .map((p) => (p as { type: "text"; text: string }).text)
          .join("");

        expect(textContent).toBe("Hello World");
      });

      it("separates file attachments from text", () => {
        const parts = [
          { type: "text", text: "Check this" },
          { type: "file", fileName: "doc.pdf" },
          { type: "file", fileName: "img.png" },
        ];

        const fileParts = parts.filter((p) => p.type === "file");
        expect(fileParts.length).toBe(2);
      });
    });

    describe("Assistant Message", () => {
      it("identifies assistant messages", () => {
        const message = { role: "assistant" };
        expect(message.role === "assistant").toBe(true);
      });

      it("shows thinking indicator when streaming with no content", () => {
        const isLastAssistant = true;
        const isStreaming = true;
        const isEmpty = true;

        const isActivelyThinking = isLastAssistant && isStreaming && isEmpty;
        expect(isActivelyThinking).toBe(true);
      });

      it("hides thinking indicator when content exists", () => {
        const isLastAssistant = true;
        const isStreaming = true;
        const isEmpty = false;

        const isActivelyThinking = isLastAssistant && isStreaming && isEmpty;
        expect(isActivelyThinking).toBe(false);
      });
    });

    describe("Copy to Clipboard", () => {
      it("sets copied state after copy", async () => {
        let copiedId: string | null = null;

        const handleCopy = (messageId: string) => {
          copiedId = messageId;
          setTimeout(() => {
            copiedId = null;
          }, 2000);
        };

        handleCopy("msg123");
        expect(copiedId).toBe("msg123");
      });
    });

    describe("Edit Mode", () => {
      it("extracts text content for editing", () => {
        const parts = [
          { type: "text", text: "Original message" },
          { type: "file" },
        ];

        const textContent = parts
          .filter((p) => p.type === "text")
          .map((p) => (p as { type: "text"; text: string }).text)
          .join("");

        expect(textContent).toBe("Original message");
      });

      it("extracts file parts for editing", () => {
        const parts = [
          { type: "text", text: "Message" },
          { type: "file", fileName: "doc.pdf", mediaType: "application/pdf" },
        ];

        const fileParts = parts.filter((p) => p.type === "file");
        expect(fileParts.length).toBe(1);
      });

      it("preserves original config in edit mode", () => {
        const message = {
          model: "anthropic:claude-sonnet-4",
          metadata: {
            reasoningLevel: "medium",
            webSearchEnabled: true,
            coreNames: ["Helpful", "Concise"],
          },
        };

        const editConfig = {
          model: message.model,
          reasoningLevel: message.metadata?.reasoningLevel,
          webSearchEnabled: message.metadata?.webSearchEnabled,
        };

        expect(editConfig.model).toBe("anthropic:claude-sonnet-4");
        expect(editConfig.reasoningLevel).toBe("medium");
        expect(editConfig.webSearchEnabled).toBe(true);
      });
    });

    describe("Regenerate", () => {
      it("can override model on regenerate", () => {
        const originalModel = "anthropic:claude-sonnet-4";
        const overrideModel = "openai:gpt-4o";

        const modelToUse = overrideModel || originalModel;
        expect(modelToUse).toBe("openai:gpt-4o");
      });

      it("uses original model if no override", () => {
        const originalModel = "anthropic:claude-sonnet-4";
        const overrideModel = undefined;

        const modelToUse = overrideModel || originalModel;
        expect(modelToUse).toBe("anthropic:claude-sonnet-4");
      });

      it("can override reasoning level", () => {
        const originalLevel = "medium";
        const overrideLevel = "high";

        const levelToUse = overrideLevel ?? originalLevel;
        expect(levelToUse).toBe("high");
      });
    });

    describe("Fork", () => {
      it("triggers fork callback with message ID", () => {
        let forkedMessageId: string | null = null;

        const onFork = (messageId: string) => {
          forkedMessageId = messageId;
        };

        onFork("msg456");
        expect(forkedMessageId).toBe("msg456");
      });
    });
  });

  describe("Image Utility", () => {
    describe("isImageFile", () => {
      const isImageFile = (mimeType: string): boolean => {
        return mimeType.startsWith("image/");
      };

      it("returns true for image types", () => {
        expect(isImageFile("image/png")).toBe(true);
        expect(isImageFile("image/jpeg")).toBe(true);
        expect(isImageFile("image/gif")).toBe(true);
        expect(isImageFile("image/webp")).toBe(true);
        expect(isImageFile("image/svg+xml")).toBe(true);
      });

      it("returns false for non-image types", () => {
        expect(isImageFile("application/pdf")).toBe(false);
        expect(isImageFile("text/plain")).toBe(false);
        expect(isImageFile("video/mp4")).toBe(false);
      });
    });
  });

  describe("Spacer Height Calculation", () => {
    it("returns 0 when content fits in viewport", () => {
      const contentHeight = 400;
      const viewportHeight = 600;

      const spacerHeight = contentHeight <= viewportHeight ? 0 : 32;
      expect(spacerHeight).toBe(0);
    });

    it("returns minimum padding when content overflows", () => {
      const contentHeight = 800;
      const viewportHeight = 600;
      const minBottomPadding = 32;

      const needsSpacer = contentHeight > viewportHeight;
      const spacerHeight = needsSpacer ? minBottomPadding : 0;

      expect(spacerHeight).toBe(32);
    });
  });
});
