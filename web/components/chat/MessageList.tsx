"use client";

import {
  useState,
  useRef,
  useLayoutEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useDeferredValue,
  useMemo,
} from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { useFileUpload } from "@/hooks/useFileUpload";
import {
  Copy,
  Pencil,
  RefreshCw,
  GitFork,
  Check,
  X,
  Send,
  Info,
  Globe,
  ChevronDown,
  ExternalLink,
  Paperclip,
  Loader2,
} from "lucide-react";
import { cn, isImageFile } from "@/lib/utils";
import { getModelDisplayName, getModelInfo } from "@/lib/models";
import { MemoizedMarkdown } from "@/components/ui/MemoizedMarkdown";
import { StepsAccordion } from "./StepsAccordion";
import { ModelCoresDropdown } from "./ModelCoresDropdown";
import { ReasoningDropdown } from "./ReasoningDropdown";
import type {
  UIMessage,
  FilePart,
  WebSearchSource,
  SourcesPart,
  ToolInvocationPart,
  MessagePart,
} from "@/types/chat";

// get file extension for badge display
function getFileExtension(fileName: string, mimeType: string): string {
  // try to get from filename first
  const ext = fileName.split(".").pop()?.toUpperCase();
  if (ext && ext.length <= 4) return ext;

  // fallback to mime type
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.includes("word")) return "DOC";
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet"))
    return "XLS";
  if (mimeType.includes("json")) return "JSON";
  if (mimeType.includes("text")) return "TXT";
  return "FILE";
}

// truncate filename for display
function truncateFileName(name: string, maxLength: number = 25): string {
  if (name.length <= maxLength) return name;
  const ext = name.split(".").pop() || "";
  const nameWithoutExt = name.slice(0, name.length - ext.length - 1);
  const truncatedName =
    nameWithoutExt.slice(0, maxLength - ext.length - 4) + "...";
  return ext ? `${truncatedName}.${ext}` : truncatedName;
}

// format reasoning level for display
function formatReasoningLevel(level: unknown, model?: string): string | null {
  if (level === undefined || level === null || level === "off") return null;

  // check if the model supports reasoning
  if (model) {
    const modelInfo = getModelInfo(model);
    if (!modelInfo.reasoningParameter) return null;

    // for budget-based (claude), format as "xk tokens"
    if (
      modelInfo.reasoningParameter?.kind === "budget" &&
      typeof level === "number"
    ) {
      return `${(level / 1000).toFixed(0)}k tokens`;
    }
  }

  // for effort-based or string values, capitalize
  if (typeof level === "string") {
    return level.charAt(0).toUpperCase() + level.slice(1);
  }

  return String(level);
}

// types for chronological message chunks
type MessageChunk =
  | {
      type: "steps";
      parts: MessagePart[];
      hasWebSearch: boolean;
      hasReasoning: boolean;
    }
  | { type: "text"; content: string }
  | { type: "sources"; sources: WebSearchSource[] };

// chunk message parts for chronological rendering
// groups consecutive non-text parts into "steps" chunks, with text chunks between them
function chunkMessageParts(parts: MessagePart[]): MessageChunk[] {
  const chunks: MessageChunk[] = [];
  let currentStepsParts: MessagePart[] = [];

  const finalizeStepsChunk = () => {
    if (currentStepsParts.length > 0) {
      const hasWebSearch = currentStepsParts.some(
        (p) =>
          p.type === "tool-invocation" &&
          (p as ToolInvocationPart).toolName.toLowerCase().includes("search")
      );
      const hasReasoning = currentStepsParts.some(
        (p) => p.type === "reasoning"
      );

      chunks.push({
        type: "steps",
        parts: currentStepsParts,
        hasWebSearch,
        hasReasoning,
      });
      currentStepsParts = [];
    }
  };

  for (const part of parts) {
    if (part.type === "text") {
      // finalize any pending steps group
      finalizeStepsChunk();
      // add text chunk (only if non-empty)
      const textPart = part as { type: "text"; text: string };
      if (textPart.text.trim()) {
        chunks.push({ type: "text", content: textPart.text });
      }
    } else if (part.type === "sources") {
      // finalize any pending steps group
      finalizeStepsChunk();
      // add sources chunk
      const sourcesPart = part as SourcesPart;
      if (sourcesPart.sources.length > 0) {
        chunks.push({ type: "sources", sources: sourcesPart.sources });
      }
    } else {
      // reasoning, tool-invocation, file - add to current steps group
      currentStepsParts.push(part);
    }
  }

  // don't forget the last steps group
  finalizeStepsChunk();

  return chunks;
}

// collapsible sources section for web search results
function SourcesSection({ sources }: { sources: WebSearchSource[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (sources.length === 0) return null;

  return (
    <div
      className="mt-4 pt-3 border-t"
      style={{ borderColor: "var(--color-border-muted)" }}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 hover:opacity-80 font-medium text-sm transition-opacity"
        style={{ color: "var(--color-text-secondary)" }}
      >
        <Globe className="w-4 h-4" />
        <span>Sources ({sources.length})</span>
        <ChevronDown
          className={cn(
            "w-4 h-4 transition-transform",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {isExpanded && (
        <div className="space-y-2 mt-2">
          {sources.map((source, i) => (
            <a
              key={i}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-0.5 hover:bg-[var(--color-background-hover)] p-2 rounded-sm transition-colors"
            >
              <div className="flex items-center gap-1">
                <span
                  className="font-medium text-sm"
                  style={{ color: "var(--color-text-link)" }}
                >
                  {source.title}
                </span>
                <ExternalLink
                  className="opacity-0 group-hover:opacity-100 w-3 h-3 transition-opacity"
                  style={{ color: "var(--color-text-link)" }}
                />
              </div>
              {source.snippet && (
                <span
                  className="text-xs line-clamp-2"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {source.snippet}
                </span>
              )}
              <span
                className="text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                {(() => {
                  try {
                    return new URL(source.url).hostname;
                  } catch {
                    return source.url;
                  }
                })()}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

interface MessageListProps {
  messages: UIMessage[];
  status: "ready" | "submitted" | "streaming" | "error";
  onEdit: (
    messageId: string,
    newContent: string,
    attachments: FilePart[],
    options?: {
      model?: string;
      reasoningLevel?: string | number;
      webSearchEnabled?: boolean;
    }
  ) => Promise<void>;
  onRegenerate: (
    messageId: string,
    options?: {
      model?: string;
      reasoningLevel?: string | number;
      attachments?: FilePart[];
      webSearchEnabled?: boolean;
    }
  ) => void;
  onFork: (messageId: string) => void;
  currentModel: string; // used as fallback if message has no model
  isAuthenticated: boolean;
}

export interface MessageListHandle {
  isEditing: () => boolean;
  addEditAttachment: (file: {
    storageId: Id<"_storage">;
    url: string;
    fileName: string;
    mimeType: string;
    size: number;
  }) => void;
}

export const MessageList = forwardRef<MessageListHandle, MessageListProps>(
  function MessageList(
    {
      messages: rawMessages,
      status,
      onEdit,
      onRegenerate,
      onFork,
      currentModel,
      isAuthenticated,
    }: MessageListProps,
    ref
  ) {
    // defer message updates to keep uI responsive during conversation switches
    const messages = useDeferredValue(rawMessages);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState("");
    const [editAttachments, setEditAttachments] = useState<FilePart[]>([]);
    // edit config state
    const [editModel, setEditModel] = useState<string>("");
    const [editReasoningLevel, setEditReasoningLevel] = useState<
      string | number
    >("medium");
    const [editWebSearchEnabled, setEditWebSearchEnabled] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // file upload state and refs for edit mode
    const editFileInputRef = useRef<HTMLInputElement>(null);
    const [isUploadingEditFile, setIsUploadingEditFile] = useState(false);

    // use the shared file upload hook
    const { processFile, checkDuplicate } = useFileUpload();

    // expose edit mode methods via ref
    useImperativeHandle(
      ref,
      () => ({
        isEditing: () => editingId !== null,
        addEditAttachment: (file) => {
          if (editingId === null) return;
          setEditAttachments((prev) => [
            ...prev,
            {
              type: "file" as const,
              mediaType: file.mimeType,
              url: file.url,
              storageId: file.storageId,
              fileName: file.fileName,
              fileSize: file.size,
            },
          ]);
        },
      }),
      [editingId]
    );
    const [previewImage, setPreviewImage] = useState<{
      url: string;
      fileName: string;
    } | null>(null);

    // regenerate config state (inline bar, similar to edit mode)
    const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
    const [regenModel, setRegenModel] = useState<string>("");
    const [regenReasoningLevel, setRegenReasoningLevel] = useState<
      string | number
    >("medium");
    const [regenAttachments, setRegenAttachments] = useState<FilePart[]>([]);
    const [regenWebSearchEnabled, setRegenWebSearchEnabled] = useState(false);

    // file upload state and refs for regen mode
    const regenFileInputRef = useRef<HTMLInputElement>(null);
    const [isUploadingRegenFile, setIsUploadingRegenFile] = useState(false);

    // dynamic spacer height - shrinks as assistant response grows
    // start with 0 to avoid hydration mismatch, will be calculated on mount
    const [spacerHeight, setSpacerHeight] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    // find the index of the last user message (memoized)
    const lastUserMessageIndex = useMemo(
      () =>
        messages.reduce(
          (lastIdx, msg, idx) => (msg.role === "user" ? idx : lastIdx),
          -1
        ),
      [messages]
    );

    // calculate spacer height - memoized to avoid recreating on every render
    const calculateSpacerHeight = useCallback(() => {
      const container = containerRef.current;
      if (!container) return;

      // get the scroll container (parent with overflow-y-auto)
      const scrollContainer = container.closest(
        ".overflow-y-auto"
      ) as HTMLElement;
      if (!scrollContainer) return;

      const viewportHeight = scrollContainer.clientHeight;

      // find the last user message element
      const lastUserMessage = container.querySelector(
        '[data-last-user-message="true"]'
      ) as HTMLElement;
      if (!lastUserMessage) {
        setSpacerHeight(0);
        return;
      }

      // find the spacer element to determine where actual content ends
      const spacerElement = container.querySelector(
        "[data-spacer]"
      ) as HTMLElement;
      if (!spacerElement) {
        setSpacerHeight(0);
        return;
      }

      // content height is the spacer's position (top of spacer = end of content)
      const contentHeightWithoutSpacer = spacerElement.offsetTop;

      // user message position from top of content
      const userMessageTop = lastUserMessage.offsetTop;

      // calculate exact spacer needed so that max scroll puts user message at top with padding
      // when scrolled to max: userMessageTop - maxScroll = padding
      // maxScroll = contentHeightWithoutSpacer + spacer - viewportHeight
      // so: spacer = userMessageTop - padding + viewportHeight - contentHeightWithoutSpacer
      const padding = 30;

      // only add spacer if content overflows viewport - otherwise no scrolling needed
      if (contentHeightWithoutSpacer <= viewportHeight) {
        setSpacerHeight(0);
        return;
      }

      // minimum bottom padding when content overflows
      const minBottomPadding = 32;

      const neededSpacer = Math.max(
        minBottomPadding,
        userMessageTop - padding + viewportHeight - contentHeightWithoutSpacer
      );

      setSpacerHeight(neededSpacer);
    }, []);

    // recalculate spacer height on messages change and window resize
    useLayoutEffect(() => {
      calculateSpacerHeight();

      window.addEventListener("resize", calculateSpacerHeight);
      return () => window.removeEventListener("resize", calculateSpacerHeight);
    }, [messages, calculateSpacerHeight]);

    // use resizeObserver to recalculate during streaming as content grows
    useLayoutEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const resizeObserver = new ResizeObserver(() => {
        calculateSpacerHeight();
      });

      resizeObserver.observe(container);

      return () => resizeObserver.disconnect();
    }, [calculateSpacerHeight]);

    const isStreaming = status === "streaming";
    const isSubmitted = status === "submitted";

    const handleCopy = async (text: string, messageId: string) => {
      await navigator.clipboard.writeText(text);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    };

    // helper to get default reasoning level for a model
    const getDefaultReasoningLevel = (modelId: string): string | number => {
      const modelInfo = getModelInfo(modelId);
      if (!modelInfo.reasoningParameter) {
        return "medium";
      }
      return modelInfo.reasoningParameter.defaultValue ?? "medium";
    };

    const handleStartEdit = (message: UIMessage) => {
      const textContent = message.parts
        .filter((p) => p.type === "text")
        .map((p) => (p as { type: "text"; text: string }).text)
        .join("");
      const fileParts = message.parts.filter(
        (p) => p.type === "file"
      ) as FilePart[];
      setEditContent(textContent);
      setEditAttachments(fileParts);
      setEditingId(message.id);

      // initialize edit config from message's original settings
      const messageModel = message.model || currentModel;
      setEditModel(messageModel);
      setEditReasoningLevel(
        message.metadata?.reasoningLevel ??
          getDefaultReasoningLevel(messageModel)
      );
      setEditWebSearchEnabled(message.metadata?.webSearchEnabled ?? false);
    };

    const handleRemoveAttachment = (index: number) => {
      setEditAttachments((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSaveEdit = async () => {
      if (editingId && (editContent.trim() || editAttachments.length > 0)) {
        const editModelInfo = getModelInfo(editModel);
        await onEdit(editingId, editContent, editAttachments, {
          model: editModel,
          reasoningLevel: editModelInfo.reasoningParameter
            ? editReasoningLevel
            : undefined,
          webSearchEnabled: editWebSearchEnabled,
        });
      }
      setEditingId(null);
      setEditContent("");
      setEditAttachments([]);
      setEditModel("");
      setEditReasoningLevel("medium");
      setEditWebSearchEnabled(false);
    };

    const handleCancelEdit = () => {
      setEditingId(null);
      setEditContent("");
      setEditAttachments([]);
      setEditModel("");
      setEditReasoningLevel("medium");
      setEditWebSearchEnabled(false);
    };

    // regenerate handlers (inline bar)
    const handleStartRegenerate = (message: UIMessage) => {
      const messageModel = message.model || currentModel;
      setRegeneratingId(message.id);
      setRegenModel(messageModel);
      setRegenReasoningLevel(
        message.metadata?.reasoningLevel ??
          getDefaultReasoningLevel(messageModel)
      );
      setRegenAttachments([]);
      setRegenWebSearchEnabled(message.metadata?.webSearchEnabled ?? false);
    };

    const handleCancelRegenerate = () => {
      setRegeneratingId(null);
      setRegenModel("");
      setRegenReasoningLevel("medium");
      setRegenAttachments([]);
      setRegenWebSearchEnabled(false);
    };

    const handleConfirmRegenerate = () => {
      if (!regeneratingId) return;

      const regenModelInfo = getModelInfo(regenModel);
      onRegenerate(regeneratingId, {
        model: regenModel,
        reasoningLevel: regenModelInfo.reasoningParameter
          ? regenReasoningLevel
          : undefined,
        attachments: regenAttachments.length > 0 ? regenAttachments : undefined,
        webSearchEnabled: regenWebSearchEnabled,
      });

      setRegeneratingId(null);
      setRegenModel("");
      setRegenReasoningLevel("medium");
      setRegenAttachments([]);
      setRegenWebSearchEnabled(false);
    };

    const handleRemoveRegenAttachment = (index: number) => {
      setRegenAttachments((prev) => prev.filter((_, i) => i !== index));
    };

    // helper to process a file and add to edit attachments
    const processEditFile = useCallback(
      async (file: File, category?: "image" | "document") => {
        const attachment = {
          id: crypto.randomUUID(),
          file,
          status: "checking" as const,
        };

        const result = await processFile(attachment, category);

        if (result.status === "ready" && result.storageId) {
          setEditAttachments((prev) => [
            ...prev,
            {
              type: "file" as const,
              mediaType: file.type,
              url: result.url ?? "",
              storageId: result.storageId,
              fileName: file.name,
              fileSize: file.size,
            },
          ]);
        }
      },
      [processFile]
    );

    // handle paste in edit mode - extract images from clipboard
    const handleEditPaste = useCallback(
      async (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        const imageFiles: File[] = [];

        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) {
              imageFiles.push(file);
            }
          }
        }

        // if no images, let default paste handle text
        if (imageFiles.length === 0) return;

        e.preventDefault();
        setIsUploadingEditFile(true);

        try {
          for (const file of imageFiles) {
            // generate filename for pasted images
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const extension = file.type.split("/")[1] || "png";
            const namedFile = new File(
              [file],
              `pasted-image-${timestamp}.${extension}`,
              { type: file.type }
            );

            await processEditFile(namedFile, "image");
          }
        } catch (error) {
          console.error("Failed to paste image:", error);
        } finally {
          setIsUploadingEditFile(false);
        }
      },
      [processEditFile]
    );

    // handle file upload in edit mode
    const handleEditFileSelect = useCallback(
      async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploadingEditFile(true);

        try {
          for (const file of Array.from(files)) {
            await processEditFile(file);
          }
        } catch (error) {
          console.error("Failed to upload file:", error);
        } finally {
          setIsUploadingEditFile(false);
          // reset the input
          if (editFileInputRef.current) {
            editFileInputRef.current.value = "";
          }
        }
      },
      [processEditFile]
    );

    // helper to process a file and add to regen attachments
    const processRegenFile = useCallback(
      async (file: File, category?: "image" | "document") => {
        const attachment = {
          id: crypto.randomUUID(),
          file,
          status: "checking" as const,
        };

        const result = await processFile(attachment, category);

        if (result.status === "ready" && result.storageId) {
          setRegenAttachments((prev) => [
            ...prev,
            {
              type: "file" as const,
              mediaType: file.type,
              url: result.url ?? "",
              storageId: result.storageId,
              fileName: file.name,
              fileSize: file.size,
            },
          ]);
        }
      },
      [processFile]
    );

    // handle file upload in regen mode
    const handleRegenFileSelect = useCallback(
      async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploadingRegenFile(true);

        try {
          for (const file of Array.from(files)) {
            await processRegenFile(file);
          }
        } catch (error) {
          console.error("Failed to upload file:", error);
        } finally {
          setIsUploadingRegenFile(false);
          // reset the input
          if (regenFileInputRef.current) {
            regenFileInputRef.current.value = "";
          }
        }
      },
      [processRegenFile]
    );

    const getTextContent = (message: UIMessage): string => {
      return message.parts
        .filter((p) => p.type === "text")
        .map((p) => (p as { type: "text"; text: string }).text)
        .join("");
    };

    return (
      <div ref={containerRef} className="space-y-8 pt-5">
        {messages.map((message, index) => {
          const isUser = message.role === "user";
          const isAssistant = message.role === "assistant";
          const isEditing = editingId === message.id;
          const textContent = getTextContent(message);
          const isLastAssistant = isAssistant && index === messages.length - 1;
          const isLastUserMessage = index === lastUserMessageIndex;

          // user message
          if (isUser) {
            return (
              <div
                key={message.id}
                data-role="user"
                data-message-id={message.id}
                data-last-user-message={isLastUserMessage ? "true" : undefined}
                className="group flex flex-col items-end gap-1"
                style={{ scrollMarginTop: "30px" }}
              >
                {isEditing ? (
                  // edit mode
                  <div className="w-full max-w-[85%]">
                    {/* show attached files above textarea in edit mode (using editAttachments state) */}
                    {editAttachments.length > 0 && (
                      <div className="flex flex-wrap justify-end gap-2 mb-2">
                        {editAttachments.map((filePart, i) => {
                          const isImage = isImageFile(filePart.mediaType);

                          if (isImage && filePart.url) {
                            return (
                              <div
                                key={i}
                                className="group/attachment relative rounded-sm overflow-hidden"
                                style={{
                                  backgroundColor:
                                    "var(--color-background-secondary)",
                                  border:
                                    "1px solid var(--color-border-default)",
                                }}
                              >
                                <img
                                  src={filePart.url}
                                  alt={filePart.fileName}
                                  className="w-20 h-20 object-cover"
                                />
                                <button
                                  onClick={() => handleRemoveAttachment(i)}
                                  className="top-1 right-1 absolute bg-black/60 hover:bg-black/80 opacity-0 group-hover/attachment:opacity-100 p-1 rounded-full text-white transition-opacity"
                                  title="Remove attachment"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={i}
                              className="group/attachment relative flex items-center gap-2 px-3 py-2 rounded-sm"
                              style={{
                                backgroundColor:
                                  "var(--color-background-secondary)",
                                border: "1px solid var(--color-border-default)",
                              }}
                            >
                              <span
                                className="font-medium text-xs"
                                style={{ color: "var(--color-text-secondary)" }}
                              >
                                {truncateFileName(filePart.fileName, 20)}
                              </span>
                              <span
                                className="px-1.5 py-0.5 rounded font-medium text-[10px]"
                                style={{
                                  backgroundColor:
                                    "var(--color-background-tertiary)",
                                  color: "var(--color-text-muted)",
                                }}
                              >
                                {getFileExtension(
                                  filePart.fileName,
                                  filePart.mediaType
                                )}
                              </span>
                              <button
                                onClick={() => handleRemoveAttachment(i)}
                                className="opacity-60 hover:opacity-100 p-0.5 rounded-full transition-opacity"
                                style={{ color: "var(--color-text-muted)" }}
                                title="Remove attachment"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onPaste={handleEditPaste}
                      className={cn(
                        "px-4 py-2.5 rounded-sm w-full resize-none",
                        "border text-base",
                        "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]",
                        "transition-all"
                      )}
                      style={{
                        backgroundColor: "var(--color-background-primary)",
                        borderColor: "var(--color-border-default)",
                        color: "var(--color-text-primary)",
                      }}
                      rows={3}
                      autoFocus
                    />

                    {/* edit config bar - same order as chatInput: model, reasoning, attach, web search */}
                    <div
                      className="flex items-center gap-1 mt-2 px-2 py-1.5 rounded-sm"
                      style={{
                        backgroundColor: "var(--color-background-secondary)",
                        border: "1px solid var(--color-border-default)",
                      }}
                    >
                      {/* hidden file input */}
                      <input
                        ref={editFileInputRef}
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx,.txt,.json,.csv,.xml,.md"
                        onChange={handleEditFileSelect}
                        className="hidden"
                      />

                      {/* model & cores selector */}
                      <ModelCoresDropdown
                        selectedModel={editModel}
                        onModelChange={(modelId) => {
                          setEditModel(modelId);
                          setEditReasoningLevel(
                            getDefaultReasoningLevel(modelId)
                          );
                        }}
                        isAuthenticated={isAuthenticated}
                      />

                      {/* reasoning selector */}
                      <ReasoningDropdown
                        selectedModel={editModel}
                        reasoningLevel={editReasoningLevel}
                        onReasoningLevelChange={setEditReasoningLevel}
                      />

                      {/* attach button */}
                      <button
                        onClick={() => editFileInputRef.current?.click()}
                        disabled={isUploadingEditFile}
                        className="flex items-center gap-1 hover:bg-[var(--color-background-hover)] disabled:opacity-50 p-1.5 rounded-sm transition-colors"
                        style={{ color: "var(--color-text-secondary)" }}
                        title="Attach files"
                      >
                        {isUploadingEditFile ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Paperclip className="w-4 h-4" />
                        )}
                      </button>

                      {/* web search toggle (only for models that support it) */}
                      {(() => {
                        const editModelInfo = getModelInfo(editModel);
                        if (!editModelInfo.supportsWebSearch) return null;

                        return (
                          <button
                            onClick={() =>
                              setEditWebSearchEnabled(!editWebSearchEnabled)
                            }
                            className={cn(
                              "flex items-center gap-1 hover:bg-[var(--color-background-hover)] p-1.5 rounded-sm transition-colors"
                            )}
                            style={{
                              color: editWebSearchEnabled
                                ? "var(--color-accent-primary)"
                                : "var(--color-text-secondary)",
                            }}
                            title={
                              editWebSearchEnabled
                                ? "Disable web search"
                                : "Enable web search"
                            }
                          >
                            <Globe className="w-4 h-4" />
                          </button>
                        );
                      })()}

                      {/* spacer */}
                      <div className="flex-1" />

                      {/* cancel button */}
                      <button
                        onClick={handleCancelEdit}
                        className="flex items-center gap-1.5 hover:bg-[var(--color-background-hover)] px-2.5 py-1 rounded-sm text-sm transition-colors"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        <X className="w-3.5 h-3.5" />
                        Cancel
                      </button>

                      {/* send button */}
                      <button
                        onClick={handleSaveEdit}
                        disabled={
                          isUploadingEditFile ||
                          (!editContent.trim() && editAttachments.length === 0)
                        }
                        className="flex items-center gap-1.5 disabled:opacity-50 px-3 py-1 rounded-sm font-medium text-sm transition-colors"
                        style={{
                          backgroundColor: "var(--color-accent-primary)",
                          color: "var(--color-text-inverse)",
                        }}
                      >
                        <Send className="w-3.5 h-3.5" />
                        Send
                      </button>
                    </div>
                  </div>
                ) : (
                  // display mode
                  (() => {
                    // filter file parts once to avoid duplicate filtering
                    const fileParts = message.parts.filter(
                      (p) => p.type === "file"
                    ) as Array<{
                      type: "file";
                      mediaType: string;
                      url?: string;
                      fileName: string;
                    }>;

                    return (
                      <>
                        {/* render file attachments as cards above text */}
                        {fileParts.length > 0 && (
                          <div className="flex flex-wrap justify-end gap-2 mb-2 max-w-[85%]">
                            {fileParts.map((filePart, i) => {
                              const isImage = isImageFile(filePart.mediaType);

                              if (isImage && filePart.url) {
                                // image card - just the image
                                return (
                                  <div
                                    key={i}
                                    className="hover:opacity-90 rounded-sm overflow-hidden transition-opacity cursor-pointer"
                                    style={{
                                      backgroundColor:
                                        "var(--color-background-secondary)",
                                      border:
                                        "1px solid var(--color-border-default)",
                                    }}
                                    onClick={() =>
                                      setPreviewImage({
                                        url: filePart.url!,
                                        fileName: filePart.fileName,
                                      })
                                    }
                                  >
                                    <img
                                      src={filePart.url}
                                      alt={filePart.fileName}
                                      className="w-40 h-40 object-cover"
                                    />
                                  </div>
                                );
                              }

                              // non-image file card - title + badge
                              return (
                                <div
                                  key={i}
                                  className="flex flex-col justify-between hover:opacity-90 p-3 rounded-sm w-40 h-40 transition-opacity cursor-pointer"
                                  style={{
                                    backgroundColor:
                                      "var(--color-background-secondary)",
                                    border:
                                      "1px solid var(--color-border-default)",
                                  }}
                                  onClick={() =>
                                    filePart.url &&
                                    window.open(filePart.url, "_blank")
                                  }
                                >
                                  <span
                                    className="font-medium text-sm line-clamp-4 leading-tight"
                                    style={{
                                      color: "var(--color-text-primary)",
                                    }}
                                    title={filePart.fileName}
                                  >
                                    {truncateFileName(filePart.fileName, 50)}
                                  </span>
                                  <span
                                    className="self-start px-2 py-0.5 rounded-sm font-medium text-xs"
                                    style={{
                                      backgroundColor:
                                        "var(--color-background-tertiary)",
                                      color: "var(--color-text-secondary)",
                                      border:
                                        "1px solid var(--color-border-default)",
                                    }}
                                  >
                                    {getFileExtension(
                                      filePart.fileName,
                                      filePart.mediaType
                                    )}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* render text content */}
                        {textContent && (
                          <div
                            className="px-4 py-2.5 rounded-sm max-w-[85%] overflow-hidden text-base"
                            style={{
                              backgroundColor:
                                "var(--color-message-user-background)",
                              color: "var(--color-message-user-text)",
                            }}
                          >
                            <p className="break-words whitespace-pre-wrap">
                              {textContent}
                            </p>
                          </div>
                        )}

                        {/* action buttons */}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* message metadata tooltip */}
                          {(message.model ||
                            message.metadata?.coreNames?.length) && (
                            <div className="group/info relative">
                              <button
                                className="hover:bg-[var(--color-background-hover)] p-1.5 rounded-sm transition-colors"
                                style={{ color: "var(--color-text-muted)" }}
                              >
                                <Info className="w-3.5 h-3.5" />
                              </button>
                              <div
                                className="top-full right-0 z-50 absolute opacity-0 group-hover/info:opacity-100 mt-1 px-2.5 py-1.5 rounded-sm text-xs whitespace-nowrap transition-opacity pointer-events-none"
                                style={{
                                  backgroundColor:
                                    "var(--color-background-secondary)",
                                  border:
                                    "1px solid var(--color-border-default)",
                                  color: "var(--color-text-secondary)",
                                }}
                              >
                                {message.model && (
                                  <div>
                                    Model: {getModelDisplayName(message.model)}
                                  </div>
                                )}
                                {message.metadata?.coreNames &&
                                  message.metadata.coreNames.length > 0 && (
                                    <div>
                                      Cores:{" "}
                                      {message.metadata.coreNames.join(", ")}
                                    </div>
                                  )}
                                {(() => {
                                  const reasoning = formatReasoningLevel(
                                    message.metadata?.reasoningLevel,
                                    message.model
                                  );
                                  return reasoning ? (
                                    <div>Reasoning: {reasoning}</div>
                                  ) : null;
                                })()}
                              </div>
                            </div>
                          )}
                          <button
                            onClick={() => handleCopy(textContent, message.id)}
                            className="hover:bg-[var(--color-background-hover)] p-1.5 rounded-sm transition-colors"
                            style={{ color: "var(--color-text-muted)" }}
                            title="Copy"
                          >
                            {copiedId === message.id ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleStartEdit(message)}
                            className="hover:bg-[var(--color-background-hover)] p-1.5 rounded-sm transition-colors"
                            style={{ color: "var(--color-text-muted)" }}
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    );
                  })()
                )}
              </div>
            );
          }

          // assistant message
          if (isAssistant) {
            const isEmpty = !textContent.trim();
            // show thinking indicator when streaming/submitted and no text response yet
            const isActivelyThinking =
              isLastAssistant && (isStreaming || isSubmitted) && isEmpty;

            // chunk message parts for chronological rendering
            const chunks = chunkMessageParts(message.parts);

            return (
              <div key={message.id} className="group">
                {/* render chunks chronologically */}
                {chunks.map((chunk, chunkIndex) => {
                  const isLastChunk = chunkIndex === chunks.length - 1;
                  const chunkKey = `${message.id}-chunk-${chunkIndex}`;

                  if (chunk.type === "steps") {
                    // unified accordion for all steps (reasoning and/or tool calls)
                    return (
                      <StepsAccordion
                        key={chunkKey}
                        parts={chunk.parts}
                        isActivelyThinking={isActivelyThinking && isLastChunk}
                        isStreaming={isStreaming && isLastChunk}
                      />
                    );
                  } else if (chunk.type === "text") {
                    // text chunk - render as markdown
                    return (
                      <div
                        key={chunkKey}
                        className="text-base leading-relaxed"
                        style={{ color: "var(--color-message-assistant-text)" }}
                      >
                        <MemoizedMarkdown
                          content={chunk.content}
                          id={chunkKey}
                        />
                      </div>
                    );
                  } else if (chunk.type === "sources") {
                    // sources chunk - render sources section
                    return (
                      <SourcesSection key={chunkKey} sources={chunk.sources} />
                    );
                  }
                  return null;
                })}

                {/* show accordion if actively thinking and no chunks yet */}
                {isActivelyThinking && chunks.length === 0 && (
                  <StepsAccordion
                    parts={[]}
                    isActivelyThinking={true}
                    isStreaming={true}
                  />
                )}

                {/* action buttons - hidden while streaming */}
                {!(isLastAssistant && isStreaming) &&
                  regeneratingId !== message.id && (
                    <div className="relative flex gap-1 opacity-0 group-hover:opacity-100 mt-2 transition-opacity">
                      <button
                        onClick={() => handleCopy(textContent, message.id)}
                        className="hover:bg-[var(--color-background-hover)] p-1.5 rounded-sm transition-colors"
                        style={{ color: "var(--color-text-muted)" }}
                        title="Copy"
                      >
                        {copiedId === message.id ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleStartRegenerate(message)}
                        className="hover:bg-[var(--color-background-hover)] p-1.5 rounded-sm transition-colors"
                        style={{ color: "var(--color-text-muted)" }}
                        title="Regenerate"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onFork(message.id)}
                        className="hover:bg-[var(--color-background-hover)] p-1.5 rounded-sm transition-colors"
                        style={{ color: "var(--color-text-muted)" }}
                        title="Fork conversation"
                      >
                        <GitFork className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                {/* regenerate config bar - inline, similar to edit mode */}
                {regeneratingId === message.id && (
                  <div className="mt-2">
                    {/* show attached files above the bar */}
                    {regenAttachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {regenAttachments.map((filePart, i) => {
                          const isImage = isImageFile(filePart.mediaType);

                          if (isImage && filePart.url) {
                            return (
                              <div
                                key={i}
                                className="group/attachment relative rounded-sm overflow-hidden"
                                style={{
                                  backgroundColor:
                                    "var(--color-background-secondary)",
                                  border:
                                    "1px solid var(--color-border-default)",
                                }}
                              >
                                <img
                                  src={filePart.url}
                                  alt={filePart.fileName}
                                  className="w-20 h-20 object-cover"
                                />
                                <button
                                  onClick={() => handleRemoveRegenAttachment(i)}
                                  className="top-1 right-1 absolute bg-black/60 hover:bg-black/80 opacity-0 group-hover/attachment:opacity-100 p-1 rounded-full text-white transition-opacity"
                                  title="Remove attachment"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={i}
                              className="group/attachment relative flex items-center gap-2 px-3 py-2 rounded-sm"
                              style={{
                                backgroundColor:
                                  "var(--color-background-secondary)",
                                border: "1px solid var(--color-border-default)",
                              }}
                            >
                              <span
                                className="font-medium text-xs"
                                style={{ color: "var(--color-text-secondary)" }}
                              >
                                {truncateFileName(filePart.fileName, 20)}
                              </span>
                              <span
                                className="px-1.5 py-0.5 rounded font-medium text-[10px]"
                                style={{
                                  backgroundColor:
                                    "var(--color-background-tertiary)",
                                  color: "var(--color-text-muted)",
                                }}
                              >
                                {getFileExtension(
                                  filePart.fileName,
                                  filePart.mediaType
                                )}
                              </span>
                              <button
                                onClick={() => handleRemoveRegenAttachment(i)}
                                className="opacity-60 hover:opacity-100 p-0.5 rounded-full transition-opacity"
                                style={{ color: "var(--color-text-muted)" }}
                                title="Remove attachment"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* config bar */}
                    <div
                      className="flex items-center gap-1 px-2 py-1.5 rounded-sm"
                      style={{
                        backgroundColor: "var(--color-background-secondary)",
                        border: "1px solid var(--color-border-default)",
                      }}
                    >
                      {/* hidden file input */}
                      <input
                        ref={regenFileInputRef}
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx,.txt,.json,.csv,.xml,.md"
                        onChange={handleRegenFileSelect}
                        className="hidden"
                      />

                      {/* model & cores selector */}
                      <ModelCoresDropdown
                        selectedModel={regenModel}
                        onModelChange={(modelId) => {
                          setRegenModel(modelId);
                          setRegenReasoningLevel(
                            getDefaultReasoningLevel(modelId)
                          );
                        }}
                        isAuthenticated={isAuthenticated}
                      />

                      {/* reasoning selector */}
                      <ReasoningDropdown
                        selectedModel={regenModel}
                        reasoningLevel={regenReasoningLevel}
                        onReasoningLevelChange={setRegenReasoningLevel}
                      />

                      {/* attach button */}
                      <button
                        onClick={() => regenFileInputRef.current?.click()}
                        disabled={isUploadingRegenFile}
                        className="flex items-center gap-1 hover:bg-[var(--color-background-hover)] disabled:opacity-50 p-1.5 rounded-sm transition-colors"
                        style={{ color: "var(--color-text-secondary)" }}
                        title="Attach files"
                      >
                        {isUploadingRegenFile ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Paperclip className="w-4 h-4" />
                        )}
                      </button>

                      {/* web search toggle (only for models that support it) */}
                      {(() => {
                        const regenModelInfo = getModelInfo(regenModel);
                        if (!regenModelInfo.supportsWebSearch) return null;

                        return (
                          <button
                            onClick={() =>
                              setRegenWebSearchEnabled(!regenWebSearchEnabled)
                            }
                            className={cn(
                              "flex items-center gap-1 hover:bg-[var(--color-background-hover)] p-1.5 rounded-sm transition-colors"
                            )}
                            style={{
                              color: regenWebSearchEnabled
                                ? "var(--color-accent-primary)"
                                : "var(--color-text-secondary)",
                            }}
                            title={
                              regenWebSearchEnabled
                                ? "Disable web search"
                                : "Enable web search"
                            }
                          >
                            <Globe className="w-4 h-4" />
                          </button>
                        );
                      })()}

                      {/* spacer */}
                      <div className="flex-1" />

                      {/* cancel button */}
                      <button
                        onClick={handleCancelRegenerate}
                        className="flex items-center gap-1.5 hover:bg-[var(--color-background-hover)] px-2.5 py-1 rounded-sm text-sm transition-colors"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        <X className="w-3.5 h-3.5" />
                        Cancel
                      </button>

                      {/* regenerate button */}
                      <button
                        onClick={handleConfirmRegenerate}
                        disabled={isUploadingRegenFile}
                        className="flex items-center gap-1.5 disabled:opacity-50 px-3 py-1 rounded-sm font-medium text-sm transition-colors"
                        style={{
                          backgroundColor: "var(--color-accent-primary)",
                          color: "var(--color-text-inverse)",
                        }}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Regenerate
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          }

          return null;
        })}

        {/* initial thinking indicator - before assistant message exists */}
        {isSubmitted &&
          (messages.length === 0 ||
            messages[messages.length - 1].role !== "assistant") && (
            <StepsAccordion
              parts={[]}
              isActivelyThinking={true}
              isStreaming={true}
            />
          )}

        {/* dynamic spacer - shrinks as assistant response grows */}
        <div
          data-spacer
          style={{ minHeight: spacerHeight }}
          aria-hidden="true"
        />

        {/* image preview modal */}
        {previewImage && (
          <div
            className="z-[100] fixed flex flex-col justify-center items-center"
            style={{
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              margin: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
            }}
            onClick={() => setPreviewImage(null)}
          >
            {/* image container with close button */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setPreviewImage(null)}
                className="top-2 -right-8 absolute text-white/70 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div
                className="rounded-sm overflow-hidden"
                style={{ backgroundColor: "var(--color-background-secondary)" }}
              >
                <img
                  src={previewImage.url}
                  alt={previewImage.fileName}
                  className="object-contain"
                  style={{
                    maxWidth: "min(720px, 85vw)",
                    maxHeight: "min(600px, 80vh)",
                  }}
                />
              </div>
              {/* filename - below image */}
              <p className="mt-3 text-white/70 text-sm text-center">
                {previewImage.fileName}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }
);
