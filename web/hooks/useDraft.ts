"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { isImageFile } from "@/lib/utils";
import { setCookie, deleteCookie } from "@/lib/cookies";

const DRAFT_STORAGE_KEY = "ourin-chat-drafts";
const ATTACHMENT_DRAFT_KEY = "ourin-chat-attachment-drafts";
const FIRST_VISIT_KEY = "ourin-first-visit-complete";
const NEW_CHAT_DRAFT_COOKIE = "ourin-new-chat-draft";
const AUTO_SEND_KEY = "ourin-auto-send-pending";

export interface Attachment {
  id: string;
  file: File;
  preview?: string;
  status: "pending" | "checking" | "uploading" | "ready" | "error";
  error?: string;
  storageId?: Id<"_storage">;
  url?: string;
  isDrawing?: boolean;
  contentHash?: string;
  isDuplicate?: boolean;
}

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

function saveDraftToStorage(
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

function markFirstVisitComplete(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(FIRST_VISIT_KEY, "true");
}

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

function saveAttachmentsDraftToStorage(
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

function clearAttachmentsDraftFromStorage(
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

// Exported utility functions for external use
export function clearNewChatDraft(): void {
  if (typeof window === "undefined") return;
  try {
    const drafts = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || "{}");
    delete drafts["new"];
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
    deleteCookie(NEW_CHAT_DRAFT_COOKIE);
  } catch {
    // Ignore storage errors
  }
}

export function setNewChatDraft(text: string, autoSend = false): void {
  if (typeof window === "undefined") return;
  try {
    const drafts = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || "{}");
    if (text.trim()) {
      drafts["new"] = text;
    } else {
      delete drafts["new"];
    }
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
    const cookieValue = text.trim()
      ? encodeURIComponent(text.substring(0, 500))
      : "";
    setCookie(NEW_CHAT_DRAFT_COOKIE, cookieValue, 60 * 60 * 24 * 7); // 7 days
    if (autoSend && text.trim()) {
      localStorage.setItem(AUTO_SEND_KEY, "true");
    }
  } catch {
    // Ignore storage errors
  }
}

export function clearNewChatAttachmentDraft(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const drafts = JSON.parse(
      localStorage.getItem(ATTACHMENT_DRAFT_KEY) || "{}"
    );
    const newChatAttachments: PersistedAttachment[] = drafts["new"] || [];

    const storageIdsToDelete = newChatAttachments
      .filter((a) => a.storageId)
      .map((a) => a.storageId);

    delete drafts["new"];
    localStorage.setItem(ATTACHMENT_DRAFT_KEY, JSON.stringify(drafts));

    return storageIdsToDelete;
  } catch {
    return [];
  }
}

interface UseDraftOptions {
  conversationId: string | null | undefined;
  initialDraft?: string;
}

interface UseDraftReturn {
  text: string;
  setText: (text: string) => void;
  attachments: Attachment[];
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  saveDraft: (text: string) => void;
  saveAttachmentsDraft: (attachments: Attachment[]) => void;
  clearAttachmentsDraft: () => void;
  clearDraft: () => void;
  autoSendPending: boolean;
  setAutoSendPending: React.Dispatch<React.SetStateAction<boolean>>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function useDraft({
  conversationId,
  initialDraft = "",
}: UseDraftOptions): UseDraftReturn {
  // Use initialDraft for new chat to prevent hydration flash
  const [text, setTextState] = useState(!conversationId ? initialDraft : "");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [autoSendPending, setAutoSendPending] = useState(false);
  const [shouldAutoSend, setShouldAutoSend] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initializedRef = useRef(false);
  const currentConversationRef = useRef<string | null | undefined>(
    conversationId
  );

  // Capture auto-send flag synchronously on mount
  useEffect(() => {
    if (!conversationId) {
      const hasAutoSendFlag = localStorage.getItem(AUTO_SEND_KEY) === "true";
      if (hasAutoSendFlag) {
        setShouldAutoSend(true);
      }
    }
  }, [conversationId]);

  // Load draft or first-visit message on mount/conversation change
  useEffect(() => {
    currentConversationRef.current = conversationId;

    if (!conversationId && isFirstVisit() && !initializedRef.current) {
      setTextState("Hi, tell me about Ourin");
      saveDraftToStorage(conversationId, "Hi, tell me about Ourin");
      markFirstVisitComplete();
      initializedRef.current = true;
    } else if (!conversationId && !initializedRef.current) {
      if (!initialDraft) {
        const draft = loadDraft(conversationId);
        setTextState(draft);
      }
      initializedRef.current = true;
    } else if (conversationId || initializedRef.current) {
      const draft = loadDraft(conversationId);
      setTextState(draft);
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
        const len = textarea.value.length;
        textarea.setSelectionRange(len, len);
      }
    });
  }, [conversationId, initialDraft]);

  // Trigger auto-send when ready
  useEffect(() => {
    if (shouldAutoSend && text.trim()) {
      localStorage.removeItem(AUTO_SEND_KEY);
      setShouldAutoSend(false);
      setAutoSendPending(true);
    }
  }, [shouldAutoSend, text]);

  const setText = useCallback((newText: string) => {
    setTextState(newText);
    saveDraftToStorage(currentConversationRef.current, newText);
  }, []);

  const saveDraft = useCallback(
    (newText: string) => {
      saveDraftToStorage(conversationId, newText);
    },
    [conversationId]
  );

  const saveAttachmentsDraft = useCallback(
    (newAttachments: Attachment[]) => {
      saveAttachmentsDraftToStorage(conversationId, newAttachments);
    },
    [conversationId]
  );

  const clearAttachmentsDraft = useCallback(() => {
    clearAttachmentsDraftFromStorage(conversationId);
  }, [conversationId]);

  const clearDraft = useCallback(() => {
    setTextState("");
    saveDraftToStorage(conversationId, "");
    clearAttachmentsDraftFromStorage(conversationId);
    setAttachments([]);
  }, [conversationId]);

  return {
    text,
    setText,
    attachments,
    setAttachments,
    saveDraft,
    saveAttachmentsDraft,
    clearAttachmentsDraft,
    clearDraft,
    autoSendPending,
    setAutoSendPending,
    textareaRef,
  };
}
