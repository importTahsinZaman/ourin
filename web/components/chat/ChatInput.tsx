"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  forwardRef,
  useImperativeHandle,
  useMemo,
} from "react";
import { ArrowUp, Square, Loader2, Globe } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { cn, isImageFile } from "@/lib/utils";
import { AttachmentChip } from "./AttachmentChip";
import { ModelCoresDropdown } from "./ModelCoresDropdown";
import { ReasoningDropdown } from "./ReasoningDropdown";
import { DrawingEditor } from "./DrawingEditor";
import { AttachmentMenu } from "./AttachmentMenu";
import { toast } from "sonner";
import {
  validateFile,
  useFileUpload,
  shouldDeleteFromStorage,
  MAX_FILE_SIZE,
  ALLOWED_TYPES,
} from "@/hooks/useFileUpload";
import { setCookie } from "@/lib/cookies";
import {
  clearNewChatDraft as clearDraftUtil,
  setNewChatDraft as setDraftUtil,
  clearNewChatAttachmentDraft as clearAttachmentDraftUtil,
} from "@/hooks/useDraft";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/Tooltip";

// MAX_FILE_SIZE and ALLOWED_TYPES imported from useFileUpload

interface Attachment {
  id: string;
  file: File;
  preview?: string;
  status: "pending" | "checking" | "uploading" | "ready" | "error";
  error?: string;
  storageId?: Id<"_storage">;
  url?: string;
  isDrawing?: boolean;
  contentHash?: string;
  isDuplicate?: boolean; // True if reusing existing file
}

interface ChatInputProps {
  onSend: (
    content: string,
    attachments: Array<{
      type: "file";
      mediaType: string;
      url: string;
      storageId?: Id<"_storage">;
      fileName: string;
      fileSize?: number;
    }>,
    options?: { webSearchEnabled?: boolean; stayInPlace?: boolean }
  ) => Promise<void>;
  onStop: () => void;
  isLoading: boolean;
  placeholder?: string;
  conversationId?: string | null;
  selectedModel: string;
  onModelChange: (model: string) => void;
  reasoningLevel: string | number;
  onReasoningLevelChange: (level: string | number) => void;
  isAuthenticated: boolean;
  initialDraft?: string;
  canSend?: boolean;
  sendBlockedReason?: string | null;
  webSearchEnabled?: boolean;
  onWebSearchToggle?: (enabled: boolean) => void;
  modelSupportsWebSearch?: boolean;
  canUseWebSearch?: boolean;
}

// ChatInputHandle for ref forwarding - exposes methods for external control
export interface ChatInputHandle {
  /** Add files programmatically (e.g., from drag-and-drop) */
  addFiles: (files: File[]) => Promise<void>;
}

const DRAFT_STORAGE_KEY = "ourin-chat-drafts";
const ATTACHMENT_DRAFT_KEY = "ourin-chat-attachment-drafts";
const FIRST_VISIT_KEY = "ourin-first-visit-complete";
const NEW_CHAT_DRAFT_COOKIE = "ourin-new-chat-draft";

interface PersistedAttachment {
  id: string;
  storageId: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  isDrawing?: boolean;
}

function getDraftKey(conversationId: string | null | undefined): string {
  return conversationId || "new";
}

function loadDraft(conversationId: string | null | undefined): string {
  if (typeof window === "undefined") return "";
  try {
    const drafts = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || "{}");
    return drafts[getDraftKey(conversationId)] || "";
  } catch {
    return "";
  }
}

function saveDraft(
  conversationId: string | null | undefined,
  text: string
): void {
  if (typeof window === "undefined") return;
  try {
    const drafts = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || "{}");
    const key = getDraftKey(conversationId);
    if (text.trim()) {
      drafts[key] = text;
    } else {
      delete drafts[key];
    }
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));

    // Also save to cookie for new chat to prevent hydration flash
    if (!conversationId) {
      const cookieValue = text.trim()
        ? encodeURIComponent(text.substring(0, 500))
        : "";
      setCookie(NEW_CHAT_DRAFT_COOKIE, cookieValue, 60 * 60 * 24 * 7); // 7 days
    }
  } catch {
    // Ignore storage errors
  }
}

function isFirstVisit(): boolean {
  if (typeof window === "undefined") return false;
  return !localStorage.getItem(FIRST_VISIT_KEY);
}

// Re-export utility functions from hooks
export const clearNewChatDraft = clearDraftUtil;

const AUTO_SEND_KEY = "ourin-auto-send-pending";

export const setNewChatDraft = setDraftUtil;
export const clearNewChatAttachmentDraft = clearAttachmentDraftUtil;

function markFirstVisitComplete(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(FIRST_VISIT_KEY, "true");
}

// Attachment draft persistence functions
function loadAttachmentsDraft(
  conversationId: string | null | undefined
): PersistedAttachment[] {
  if (typeof window === "undefined") return [];
  try {
    const drafts = JSON.parse(
      localStorage.getItem(ATTACHMENT_DRAFT_KEY) || "{}"
    );
    return drafts[getDraftKey(conversationId)] || [];
  } catch {
    return [];
  }
}

function saveAttachmentsDraft(
  conversationId: string | null | undefined,
  attachments: Attachment[]
): void {
  if (typeof window === "undefined") return;
  try {
    const drafts = JSON.parse(
      localStorage.getItem(ATTACHMENT_DRAFT_KEY) || "{}"
    );
    const key = getDraftKey(conversationId);

    // Only persist ready attachments with storageId
    const toPersist: PersistedAttachment[] = attachments
      .filter((a) => a.status === "ready" && a.storageId && a.url)
      .map((a) => ({
        id: a.id,
        storageId: a.storageId as string,
        url: a.url!,
        fileName: a.file.name,
        mimeType: a.file.type,
        size: a.file.size,
        isDrawing: a.isDrawing,
      }));

    if (toPersist.length > 0) {
      drafts[key] = toPersist;
    } else {
      delete drafts[key];
    }
    localStorage.setItem(ATTACHMENT_DRAFT_KEY, JSON.stringify(drafts));
  } catch {
    // Ignore storage errors
  }
}

function clearAttachmentsDraft(
  conversationId: string | null | undefined
): void {
  if (typeof window === "undefined") return;
  try {
    const drafts = JSON.parse(
      localStorage.getItem(ATTACHMENT_DRAFT_KEY) || "{}"
    );
    delete drafts[getDraftKey(conversationId)];
    localStorage.setItem(ATTACHMENT_DRAFT_KEY, JSON.stringify(drafts));
  } catch {
    // Ignore storage errors
  }
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  function ChatInput(
    {
      onSend,
      onStop,
      isLoading,
      placeholder = "What can I do for you?",
      conversationId,
      selectedModel,
      onModelChange,
      reasoningLevel,
      onReasoningLevelChange,
      isAuthenticated,
      initialDraft = "",
      canSend = true,
      sendBlockedReason = null,
      webSearchEnabled = false,
      onWebSearchToggle,
      modelSupportsWebSearch = false,
      canUseWebSearch = false,
    },
    ref
  ) {
    // Use initialDraft for new chat to prevent hydration flash
    const [text, setText] = useState(!conversationId ? initialDraft : "");
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [showDrawingEditor, setShowDrawingEditor] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const initializedRef = useRef(false);
    const [autoSendPending, setAutoSendPending] = useState(false);
    const [shouldAutoSend, setShouldAutoSend] = useState(false);
    const currentConversationRef = useRef<string | null | undefined>(
      conversationId
    );

    // Capture auto-send flag synchronously on mount (before paint)
    // Note: We just READ the flag here, don't clear it yet (StrictMode double-invokes effects)
    useLayoutEffect(() => {
      if (!conversationId) {
        const hasAutoSendFlag = localStorage.getItem(AUTO_SEND_KEY) === "true";
        if (hasAutoSendFlag) {
          setShouldAutoSend(true);
        }
      }
    }, [conversationId]);

    // File upload functionality from hook
    const { processFile, deleteFile: deleteFileFromStorage } = useFileUpload();

    // Core file processing logic - shared between file input and drag-drop
    const processFiles = useCallback(
      async (files: File[]) => {
        const newAttachments: Attachment[] = [];

        for (const file of files) {
          const validation = validateFile(file);
          const id = crypto.randomUUID();

          // Create preview for images
          let preview: string | undefined;
          if (isImageFile(file.type)) {
            preview = URL.createObjectURL(file);
          }

          if (!validation.valid) {
            newAttachments.push({
              id,
              file,
              preview,
              status: "error",
              error: validation.error,
            });
            // Show toast for invalid files
            toast.error(`Cannot attach ${file.name}`, {
              description: validation.error,
            });
          } else {
            // Start with "checking" status while we compute hash and check for duplicates
            newAttachments.push({
              id,
              file,
              preview,
              status: "checking",
            });
          }
        }

        if (newAttachments.length === 0) return;

        setAttachments((prev) => [...prev, ...newAttachments]);

        // Process files (hash, dedup check, upload if needed)
        for (const attachment of newAttachments) {
          if (attachment.status === "checking") {
            const updated = await processFile(attachment);
            setAttachments((prev) => {
              const newList = prev.map((a) =>
                a.id === attachment.id ? updated : a
              );
              // Save to draft after successful processing
              saveAttachmentsDraft(currentConversationRef.current, newList);
              return newList;
            });
          }
        }
      },
      [processFile]
    );

    // Expose addFiles method for external control (e.g., drag-and-drop from ChatArea)
    useImperativeHandle(
      ref,
      () => ({
        addFiles: processFiles,
      }),
      [processFiles]
    );

    // Handle text changes - save draft immediately
    const handleTextChange = useCallback((newText: string) => {
      setText(newText);
      saveDraft(currentConversationRef.current, newText);
    }, []);

    // Load draft or first-visit message on mount/conversation change
    useEffect(() => {
      // Update current conversation ref
      currentConversationRef.current = conversationId;

      // Check for first visit on new chat
      if (!conversationId && isFirstVisit() && !initializedRef.current) {
        setText("Hi, tell me about Ourin");
        saveDraft(conversationId, "Hi, tell me about Ourin");
        markFirstVisitComplete();
        initializedRef.current = true;
      } else if (!conversationId && !initializedRef.current) {
        // New chat - cookie already set initial state via useState
        // If no cookie, fall back to localStorage
        if (!initialDraft) {
          const draft = loadDraft(conversationId);
          setText(draft);
        }
        initializedRef.current = true;
      } else if (conversationId || initializedRef.current) {
        // Load saved draft for existing conversation, or when navigating back to new chat
        const draft = loadDraft(conversationId);
        setText(draft);
      }

      // Load attachment drafts
      const savedAttachments = loadAttachmentsDraft(conversationId);
      if (savedAttachments.length > 0) {
        const restored: Attachment[] = savedAttachments.map((a) => ({
          id: a.id,
          file: new File([], a.fileName, { type: a.mimeType }),
          preview: isImageFile(a.mimeType) ? a.url : undefined,
          status: "ready" as const,
          storageId: a.storageId as Id<"_storage">,
          url: a.url,
          isDrawing: a.isDrawing,
        }));
        setAttachments(restored);
      } else {
        setAttachments([]);
      }

      // Resize textarea after setting text
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.style.height = "auto";
          textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
          textarea.focus();
          // Move cursor to end of text
          const len = textarea.value.length;
          textarea.setSelectionRange(len, len);
        }
      });
    }, [conversationId]);

    // Trigger auto-send when text is loaded and shouldAutoSend is true
    useEffect(() => {
      if (shouldAutoSend && text.trim() && !isLoading) {
        // Clear the localStorage flag NOW (after state has propagated)
        localStorage.removeItem(AUTO_SEND_KEY);
        setShouldAutoSend(false);
        setAutoSendPending(true);
      }
    }, [shouldAutoSend, text, isLoading]);

    // Handle file selection from file input
    const handleFileSelect = useCallback(
      async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        // Reset input first to allow re-selecting same file
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }

        await processFiles(Array.from(files));
      },
      [processFiles]
    );

    // Remove attachment
    const removeAttachment = useCallback(
      async (id: string) => {
        const attachment = attachments.find((a) => a.id === id);
        if (!attachment) return;

        // Delete from storage if appropriate (checks for duplicates, etc.)
        if (shouldDeleteFromStorage(attachment, attachments)) {
          await deleteFileFromStorage(attachment.storageId!);
        }

        // Clean up preview URL only if:
        // - Not a duplicate (preview URL is from Convex, not an object URL we created)
        // - No other attachments share the same preview
        if (attachment.preview && !attachment.isDuplicate) {
          const othersWithSamePreview = attachments.filter(
            (a) => a.id !== id && a.preview === attachment.preview
          );
          if (othersWithSamePreview.length === 0) {
            URL.revokeObjectURL(attachment.preview);
          }
        }

        // Remove from state and update persisted drafts
        setAttachments((prev) => {
          const updated = prev.filter((a) => a.id !== id);
          saveAttachmentsDraft(conversationId, updated);
          return updated;
        });
      },
      [attachments, deleteFileFromStorage, conversationId]
    );

    // Handle send
    const handleSend = useCallback(
      async (options?: { stayInPlace?: boolean }) => {
        // Check if sending is blocked
        if (!canSend) {
          if (sendBlockedReason) {
            toast.error("Cannot send message", {
              description: sendBlockedReason,
            });
          }
          return;
        }

        const trimmedText = text.trim();
        const readyAttachments = attachments.filter(
          (a) => a.status === "ready"
        );

        if (!trimmedText && readyAttachments.length === 0) return;

        // Build attachment data
        const attachmentData = readyAttachments.map((a) => ({
          type: "file" as const,
          mediaType: a.file.type,
          url: a.url || a.preview || "",
          storageId: a.storageId,
          fileName: a.file.name,
          fileSize: a.file.size,
        }));

        // Clear input and draft
        setText("");
        saveDraft(conversationId, "");
        clearAttachmentsDraft(conversationId);
        setAttachments([]);

        // Reset textarea height immediately
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }

        // Send (pass stayInPlace to prevent auto-scroll)
        await onSend(trimmedText, attachmentData, {
          webSearchEnabled,
          stayInPlace: options?.stayInPlace,
        });
      },
      [
        text,
        attachments,
        onSend,
        conversationId,
        canSend,
        sendBlockedReason,
        webSearchEnabled,
      ]
    );

    // Handle key press
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (!isLoading) {
            // Ctrl/Cmd+Enter = send without scrolling (stay in place)
            const stayInPlace = e.ctrlKey || e.metaKey;
            handleSend({ stayInPlace });
          }
        }
      },
      [isLoading, handleSend]
    );

    // Handle auto-send from command palette
    useEffect(() => {
      if (autoSendPending && text.trim() && !isLoading) {
        setAutoSendPending(false);
        handleSend();
      }
    }, [autoSendPending, text, isLoading, handleSend]);

    // Auto-resize textarea
    const handleInput = useCallback(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = "auto";
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
      }
    }, []);

    // Handle paste - extract images from clipboard
    const handlePaste = useCallback(
      async (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        const imageFiles: File[] = [];

        for (const item of Array.from(items)) {
          // Check if the item is an image
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) {
              imageFiles.push(file);
            }
          }
        }

        // If no images found, let default paste behavior handle it (text)
        if (imageFiles.length === 0) return;

        // Prevent default paste behavior for images
        e.preventDefault();

        // Process each image file
        const newAttachments: Attachment[] = [];

        for (const file of imageFiles) {
          const validation = validateFile(file);
          const id = crypto.randomUUID();

          // Generate a filename for pasted images
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          const extension = file.type.split("/")[1] || "png";
          const namedFile = new File(
            [file],
            `pasted-image-${timestamp}.${extension}`,
            { type: file.type }
          );

          // Create preview
          const preview = URL.createObjectURL(file);

          if (!validation.valid) {
            newAttachments.push({
              id,
              file: namedFile,
              preview,
              status: "error",
              error: validation.error,
            });
          } else {
            newAttachments.push({
              id,
              file: namedFile,
              preview,
              status: "checking",
            });
          }
        }

        setAttachments((prev) => [...prev, ...newAttachments]);

        // Process files (hash, dedup check, upload if needed)
        for (const attachment of newAttachments) {
          if (attachment.status === "checking") {
            const updated = await processFile(attachment, "image");
            setAttachments((prev) => {
              const newList = prev.map((a) =>
                a.id === attachment.id ? updated : a
              );
              saveAttachmentsDraft(conversationId, newList);
              return newList;
            });
          }
        }
      },
      [conversationId, processFile]
    );

    const hasContent = useMemo(
      () => text.trim() || attachments.some((a) => a.status === "ready"),
      [text, attachments]
    );
    const hasUploadingFiles = useMemo(
      () =>
        attachments.some(
          (a) => a.status === "uploading" || a.status === "checking"
        ),
      [attachments]
    );

    // Clean up object URLs on unmount to prevent memory leaks
    useEffect(() => {
      return () => {
        attachments.forEach((a) => {
          if (a.preview && !a.url?.startsWith("http")) {
            URL.revokeObjectURL(a.preview);
          }
        });
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run cleanup on unmount

    // Handle file upload from menu
    const handleUploadFile = useCallback(() => {
      fileInputRef.current?.click();
    }, []);

    // Take screenshot using Screen Capture API
    const handleTakeScreenshot = useCallback(async () => {
      try {
        // Create CaptureController to prevent focus switching (Conditional Focus API)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const CaptureControllerCtor = (globalThis as any).CaptureController;
        const controller = CaptureControllerCtor
          ? new CaptureControllerCtor()
          : null;

        // Build options
        const displayMediaOptions: DisplayMediaStreamOptions &
          Record<string, unknown> = {
          video: {
            displaySurface: "window",
          },
          audio: false,
          preferCurrentTab: false,
          selfBrowserSurface: "exclude",
          systemAudio: "exclude",
          surfaceSwitching: "exclude",
          monitorTypeSurfaces: "include",
        };

        // Add controller if supported
        if (controller) {
          displayMediaOptions.controller = controller;
        }

        // Request screen share
        const stream =
          await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

        // Prevent focus change - must be called synchronously after getDisplayMedia resolves
        if (controller) {
          try {
            controller.setFocusBehavior("no-focus-change");
          } catch {
            // Ignore if not supported
          }
        }

        // Get the video track
        const videoTrack = stream.getVideoTracks()[0];

        // Create a video element to capture a frame
        const video = document.createElement("video");
        video.srcObject = stream;
        video.autoplay = true;

        // Wait for video to be ready
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => {
            video.play();
            resolve();
          };
        });

        // Small delay to ensure frame is rendered
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Create canvas and capture frame
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Could not get canvas context");
        }
        ctx.drawImage(video, 0, 0);

        // Stop the stream immediately
        videoTrack.stop();
        stream.getTracks().forEach((track) => track.stop());

        // Convert to blob
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error("Failed to create blob"));
              }
            },
            "image/png",
            1.0
          );
        });

        // Create file from blob
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const file = new File([blob], `screenshot-${timestamp}.png`, {
          type: "image/png",
        });

        // Create attachment
        const id = crypto.randomUUID();
        const preview = URL.createObjectURL(blob);

        const newAttachment: Attachment = {
          id,
          file,
          preview,
          status: "checking",
        };

        setAttachments((prev) => [...prev, newAttachment]);

        // Process the file (hash, dedup check, upload if needed)
        const processed = await processFile(newAttachment, "screenshot");
        setAttachments((prev) => {
          const newList = prev.map((a) => (a.id === id ? processed : a));
          saveAttachmentsDraft(conversationId, newList);
          return newList;
        });
      } catch (error) {
        // User cancelled or error occurred
        if (error instanceof Error && error.name !== "NotAllowedError") {
          toast.error("Screenshot failed", {
            description: "Could not capture screenshot. Please try again.",
          });
        }
      }
    }, [conversationId, processFile]);

    const handleCreateDrawing = useCallback(() => {
      setShowDrawingEditor(true);
    }, []);

    // State for editing existing drawing
    const [editingDrawing, setEditingDrawing] = useState<{
      id: string;
      preview: string;
    } | null>(null);

    // Handle drawing save (new or edit)
    const handleDrawingSave = useCallback(
      async (file: File, preview: string) => {
        if (editingDrawing) {
          // Editing existing drawing - update the attachment
          const attachmentId = editingDrawing.id;

          // Revoke old preview URL
          const oldAttachment = attachments.find((a) => a.id === attachmentId);
          if (oldAttachment?.preview) {
            URL.revokeObjectURL(oldAttachment.preview);
          }

          // Update to checking state with new preview
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === attachmentId
                ? { ...a, file, preview, status: "checking" as const }
                : a
            )
          );

          // Process the new file (hash, dedup check, upload if needed)
          const processed = await processFile(
            {
              id: attachmentId,
              file,
              preview,
              status: "checking",
              isDrawing: true,
            },
            "drawing"
          );

          setAttachments((prev) => {
            const newList = prev.map((a) =>
              a.id === attachmentId ? { ...processed, isDrawing: true } : a
            );
            saveAttachmentsDraft(conversationId, newList);
            return newList;
          });

          setEditingDrawing(null);
        } else {
          // Creating new drawing
          const id = crypto.randomUUID();

          const newAttachment: Attachment = {
            id,
            file,
            preview,
            status: "checking",
            isDrawing: true,
          };

          setAttachments((prev) => [...prev, newAttachment]);

          // Process the file (hash, dedup check, upload if needed)
          const processed = await processFile(newAttachment, "drawing");
          setAttachments((prev) => {
            const newList = prev.map((a) =>
              a.id === id ? { ...processed, isDrawing: true } : a
            );
            saveAttachmentsDraft(conversationId, newList);
            return newList;
          });
        }
      },
      [editingDrawing, attachments, conversationId, processFile]
    );

    // Handle edit drawing request from attachment chip
    const handleEditDrawing = useCallback((id: string, preview: string) => {
      setEditingDrawing({ id, preview });
      setShowDrawingEditor(true);
    }, []);

    return (
      <TooltipProvider delayDuration={300}>
        <div
          className={cn(
            "flex flex-col",
            "rounded-2xl",
            "shadow-sm",
            "focus-within:border-[var(--color-border-default)]"
          )}
          style={{
            backgroundColor: "var(--color-background-input)",
            border: "1px solid var(--color-border-default)",
          }}
        >
          {/* Attachment previews */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pt-3">
              {attachments.map((attachment) => (
                <AttachmentChip
                  key={attachment.id}
                  fileName={attachment.file.name}
                  mimeType={attachment.file.type}
                  status={attachment.status}
                  error={attachment.error}
                  preview={attachment.preview}
                  onRemove={() => removeAttachment(attachment.id)}
                  isDrawing={attachment.isDrawing}
                  onEdit={
                    attachment.isDrawing && attachment.preview
                      ? () =>
                          handleEditDrawing(attachment.id, attachment.preview!)
                      : undefined
                  }
                />
              ))}
            </div>
          )}

          {/* Text input area */}
          <div className="relative px-4 pt-4 pb-2">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => {
                handleTextChange(e.target.value);
                handleInput();
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={placeholder}
              rows={2}
              className={cn(
                "w-full min-h-[48px] max-h-[200px] resize-none",
                "bg-transparent outline-none border-none focus:ring-0 focus-visible:outline-none",
                "placeholder:text-[var(--color-text-muted)]"
              )}
              style={{ color: "var(--color-text-primary)" }}
            />
          </div>

          {/* Bottom bar */}
          <div className="flex justify-between items-center px-3 pb-3">
            <div className="flex items-center gap-1">
              {/* Model & Cores dropdown */}
              <ModelCoresDropdown
                selectedModel={selectedModel}
                onModelChange={onModelChange}
                isAuthenticated={isAuthenticated}
              />

              {/* Reasoning level dropdown (only for reasoning models) */}
              <ReasoningDropdown
                selectedModel={selectedModel}
                reasoningLevel={reasoningLevel}
                onReasoningLevelChange={onReasoningLevelChange}
              />

              {/* Web Search toggle - show when model supports it, disable for non-subscribers */}
              {modelSupportsWebSearch && onWebSearchToggle && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() =>
                        canUseWebSearch && onWebSearchToggle(!webSearchEnabled)
                      }
                      disabled={!canUseWebSearch}
                      className={cn(
                        "p-1.5 rounded-sm transition-colors",
                        canUseWebSearch &&
                          "hover:bg-[var(--color-background-hover)]",
                        !canUseWebSearch && "opacity-50 cursor-not-allowed",
                        webSearchEnabled &&
                          canUseWebSearch &&
                          "bg-[var(--color-accent-primary-muted)]"
                      )}
                      style={{
                        color:
                          webSearchEnabled && canUseWebSearch
                            ? "var(--color-accent-primary)"
                            : "var(--color-text-secondary)",
                      }}
                    >
                      <Globe className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {!canUseWebSearch
                      ? "Web search requires subscription"
                      : webSearchEnabled
                        ? "Disable web search"
                        : "Enable web search"}
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Attachment menu */}
              <AttachmentMenu
                onUploadFile={handleUploadFile}
                onTakeScreenshot={handleTakeScreenshot}
                onCreateDrawing={handleCreateDrawing}
              />

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ALLOWED_TYPES.join(",")}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Send/Stop button */}
            {isLoading ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onStop}
                    className="flex justify-center items-center bg-red-100 hover:bg-red-200 rounded-sm w-8 h-8 transition-colors"
                  >
                    <Square className="fill-red-600 w-3 h-3 text-red-600" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Stop generating</TooltipContent>
              </Tooltip>
            ) : !canSend && sendBlockedReason ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleSend()}
                    disabled={!hasContent || hasUploadingFiles}
                    className={cn(
                      "flex justify-center items-center rounded-sm w-8 h-8 transition-all",
                      "cursor-not-allowed opacity-60"
                    )}
                    style={{
                      backgroundColor: "var(--color-accent-primary-muted)",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {hasUploadingFiles ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowUp className="w-4 h-4" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="max-w-[250px] text-center"
                >
                  {sendBlockedReason}
                </TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={() => handleSend()}
                disabled={!hasContent || hasUploadingFiles}
                className="flex justify-center items-center rounded-sm w-8 h-8 transition-all"
                style={{
                  backgroundColor:
                    hasContent && !hasUploadingFiles
                      ? "var(--color-accent-primary)"
                      : "var(--color-accent-primary-muted)",
                  color:
                    hasContent && !hasUploadingFiles
                      ? "var(--color-text-inverse)"
                      : "var(--color-text-muted)",
                }}
              >
                {hasUploadingFiles ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowUp className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Drawing Editor Modal */}
        <DrawingEditor
          isOpen={showDrawingEditor}
          onClose={() => {
            setShowDrawingEditor(false);
            setEditingDrawing(null);
          }}
          onSave={handleDrawingSave}
          initialImage={editingDrawing?.preview}
        />
      </TooltipProvider>
    );
  }
);
