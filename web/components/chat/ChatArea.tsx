"use client";

import {
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
  useMemo,
  startTransition,
} from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { MessageList, type MessageListHandle } from "./MessageList";
import { ChatInput, type ChatInputHandle } from "./ChatInput";
import { DropZoneOverlay } from "./DropZoneOverlay";
import { useOurinChat } from "@/hooks/useOurinChat";
import { useCores } from "@/hooks/useCores";
import { useFileDrop } from "@/hooks/useFileDrop";
import { useAnalytics } from "@/hooks/useAnalytics";
import { getModelInfo, FREE_MODEL_ID } from "@/lib/models";
import { setCookie } from "@/lib/cookies";
import type { Id } from "@/convex/_generated/dataModel";
import type { UIMessage, FilePart } from "@/types/chat";

// Get default reasoning level for a model
function getDefaultReasoningLevel(modelId: string): string | number {
  const modelInfo = getModelInfo(modelId);
  if (!modelInfo.reasoningParameter) {
    return "medium"; // Fallback
  }
  return modelInfo.reasoningParameter.defaultValue ?? "medium";
}

// Easing function for smooth scroll animation (defined outside to avoid recreation)
const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const USER_TIER_COOKIE = "ourin-user-tier";

interface ChatAreaProps {
  conversationId: string | null;
  onConversationCreate: (id: string) => void;
  onFork?: (newConversationId: string) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  initialNewChatDraft?: string;
  newChatResetKey?: number;
  reasoningLevel: string | number;
  onReasoningLevelChange: (level: string | number) => void;
  webSearchEnabled: boolean;
  onWebSearchEnabledChange: (enabled: boolean) => void;
  initialUserTier?: string;
  chatInputRef?: React.RefObject<ChatInputHandle | null>;
  messageListRef?: React.RefObject<MessageListHandle | null>;
}

export function ChatArea({
  conversationId,
  onConversationCreate,
  onFork,
  selectedModel,
  onModelChange,
  initialNewChatDraft = "",
  newChatResetKey = 0,
  reasoningLevel,
  onReasoningLevelChange,
  webSearchEnabled,
  onWebSearchEnabledChange,
  initialUserTier,
  chatInputRef,
  messageListRef,
}: ChatAreaProps) {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const analytics = useAnalytics();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Internal ref for ChatInput - use provided ref or create our own
  const internalChatInputRef = useRef<ChatInputHandle>(null);
  const effectiveChatInputRef = chatInputRef ?? internalChatInputRef;

  // Handle files dropped via drag-and-drop
  const handleFilesDrop = useCallback(
    (files: File[]) => {
      effectiveChatInputRef.current?.addFiles(files);
    },
    [effectiveChatInputRef]
  );

  // Set up drag-and-drop
  const { isDragging, dropHandlers } = useFileDrop({
    onDrop: handleFilesDrop,
  });

  // Get user tier info to determine if they can send messages
  const tierInfo = useQuery(
    api.billing.getUserTier,
    isAuthenticated ? {} : "skip"
  );

  // Memoize model info to avoid multiple getModelInfo calls
  const modelInfo = useMemo(() => getModelInfo(selectedModel), [selectedModel]);

  // Compute send restriction based on tier and selected model
  const sendRestriction = useMemo(() => {
    // Still loading tier info - allow sending (will be checked server-side)
    if (isAuthenticated && tierInfo === undefined) {
      return { canSend: true, reason: null };
    }

    // Not authenticated - check handled client-side in useOurinChat via localStorage
    if (!isAuthenticated) {
      return { canSend: true, reason: null };
    }

    // Check tier-specific restrictions
    if (tierInfo) {
      // Self-hosted tier: no restrictions
      if (tierInfo.tier === "self_hosted") {
        return { canSend: true, reason: null };
      }

      // Free tier: model restriction + message limit
      if (tierInfo.tier === "free") {
        if (selectedModel !== FREE_MODEL_ID) {
          return {
            canSend: false,
            reason:
              "Free users can only use Gemini 2.5 Flash Lite. Subscribe or add an API key to access other models.",
          };
        }
        if (!tierInfo.canSendMessage) {
          return {
            canSend: false,
            reason:
              "You've reached the free message limit. Subscribe to continue.",
          };
        }
      }

      // Own keys tier: check if they have key for this provider
      if (tierInfo.tier === "own_keys") {
        if (!tierInfo.providers?.includes(modelInfo.provider)) {
          return {
            canSend: false,
            reason: `Add a ${modelInfo.provider} API key to use this model.`,
          };
        }
      }

      // Subscriber tier: check credits
      if (tierInfo.tier === "subscriber") {
        if (!tierInfo.canSendMessage) {
          return {
            canSend: false,
            reason:
              "You've run out of credits. Purchase more credits to continue, or wait for the next billing cycle.",
          };
        }
      }
    }

    return { canSend: true, reason: null };
  }, [isAuthenticated, tierInfo, selectedModel, modelInfo]);

  // Persist user tier to cookie when it changes (for preventing flash on reload)
  useEffect(() => {
    if (tierInfo?.tier) {
      setCookie(USER_TIER_COOKIE, tierInfo.tier);
    }
  }, [tierInfo?.tier]);

  // Check if current model supports web search (uses memoized modelInfo)
  const modelSupportsWebSearch = modelInfo.supportsWebSearch;

  // Check if user can use web search (subscriber or self-hosted)
  const canUseWebSearch = useMemo(() => {
    // While auth is loading, use the cookie value to prevent flash
    if (isAuthLoading) {
      return (
        initialUserTier === "subscriber" || initialUserTier === "self_hosted"
      );
    }
    if (!isAuthenticated) return false;
    // Use tierInfo if loaded, otherwise fall back to initialUserTier from cookie
    const effectiveTier = tierInfo?.tier ?? initialUserTier;
    return effectiveTier === "subscriber" || effectiveTier === "self_hosted";
  }, [isAuthLoading, isAuthenticated, tierInfo, initialUserTier]);

  // Reset reasoning level and web search when model changes
  const handleModelChange = useCallback(
    (newModel: string) => {
      onModelChange(newModel);
      onReasoningLevelChange(getDefaultReasoningLevel(newModel));
      // Reset web search if new model doesn't support it
      const newModelInfo = getModelInfo(newModel);
      if (!newModelInfo.supportsWebSearch) {
        onWebSearchEnabledChange(false);
      }
    },
    [onModelChange, onReasoningLevelChange, onWebSearchEnabledChange]
  );

  // Get active core names and prompt for message metadata
  const { getActiveCoreNames, getActivePrompt } = useCores();

  // Load persisted messages if we have a conversation
  const persistedMessages = useQuery(
    api.messages.getByConversation,
    conversationId
      ? { conversationId: conversationId as Id<"conversations"> }
      : "skip"
  );

  // Initialize chat hook
  const {
    messages,
    status,
    sendMessage,
    setMessages,
    stop,
    regenerate,
    editAndResend,
    forkConversation,
  } = useOurinChat({
    conversationId,
    initialMessages: (persistedMessages as unknown as UIMessage[]) ?? [],
    model: selectedModel,
    reasoningLevel,
    onConversationCreate,
    getActiveCoreNames,
    getActivePrompt,
  });

  // Track if this is the initial load for this conversation
  const hasLoadedRef = useRef<string | null>(null);
  const shouldScrollToUserMessageRef = useRef(false);
  const shouldScrollToBottomOnLoadRef = useRef(false);
  // Track previous status and conversation to detect transitions
  const prevStatusRef = useRef<string>(status);
  const prevConversationIdRef = useRef<string | null>(conversationId);
  // Track when we just finished streaming to skip immediate sync (prevents flash)
  // Use a counter to skip multiple render cycles (Convex update may arrive later)
  const skipSyncCountRef = useRef(0);

  useEffect(() => {
    const wasStreaming =
      prevStatusRef.current === "streaming" ||
      prevStatusRef.current === "submitted";
    const conversationChanged =
      prevConversationIdRef.current !== conversationId;
    const isNowReady = status === "ready";

    // Detect when streaming just finished in this client
    // Set counter to skip next few Convex syncs (prevents flash from double-update)
    // We skip 2 cycles because Convex update may arrive in a later render
    if (wasStreaming && isNowReady && !conversationChanged) {
      skipSyncCountRef.current = 2;
    }

    prevStatusRef.current = status;
    prevConversationIdRef.current = conversationId;

    // Load persisted messages when:
    // 1. First load of this conversation (hasLoadedRef !== conversationId)
    // 2. AND we have persisted messages
    // 3. AND we're not streaming THIS conversation
    // 4. AND (we just switched conversations OR we didn't just finish streaming)
    //    - Always load immediately when switching conversations
    //    - Don't interrupt scroll if streaming just finished in same conversation
    if (
      conversationId &&
      hasLoadedRef.current !== conversationId &&
      persistedMessages &&
      persistedMessages.length > 0 &&
      status === "ready" &&
      (conversationChanged || !wasStreaming)
    ) {
      hasLoadedRef.current = conversationId;
      // Use startTransition to prevent blocking UI during heavy message rendering
      startTransition(() => {
        setMessages(persistedMessages as unknown as UIMessage[]);
      });
      // Flag to scroll to bottom after messages are loaded
      shouldScrollToBottomOnLoadRef.current = true;
    }

    // Update hasLoadedRef when conversation changes (even during streaming)
    // This prevents scroll-to-bottom when streaming ends in a new conversation
    if (
      conversationId &&
      hasLoadedRef.current !== conversationId &&
      (status === "streaming" || status === "submitted")
    ) {
      hasLoadedRef.current = conversationId;
    }

    // Reset when conversation changes to null (new chat)
    if (!conversationId && hasLoadedRef.current !== null) {
      hasLoadedRef.current = null;
      startTransition(() => {
        setMessages([]);
      });
    }
  }, [conversationId, persistedMessages, setMessages, status]);

  // Sync Convex updates to local state when NOT streaming (for multi-device sync)
  // This allows other clients to see streaming updates in real-time
  const lastSyncedRef = useRef<{
    length: number;
    lastMessageId: string | null;
    partsHash: string | null;
  }>({
    length: 0,
    lastMessageId: null,
    partsHash: null,
  });
  useEffect(() => {
    // Only sync when we're ready (not streaming ourselves)
    if (status !== "ready") return;
    // Only sync after initial load
    if (!hasLoadedRef.current || hasLoadedRef.current !== conversationId)
      return;
    // Only sync if we have messages from Convex
    if (!persistedMessages || persistedMessages.length === 0) return;

    // Skip sync if we just finished streaming in this client
    // This prevents double-update flash (local state already updated by useOurinChat)
    if (skipSyncCountRef.current > 0) {
      skipSyncCountRef.current--;
      // Still update lastSyncedRef to prevent sync on next render
      const lastMessage = persistedMessages[persistedMessages.length - 1];
      lastSyncedRef.current = {
        length: persistedMessages.length,
        lastMessageId: lastMessage?.id ?? null,
        partsHash: lastMessage ? JSON.stringify(lastMessage.parts) : null,
      };
      return;
    }

    // Check if Convex has more/different messages than our last sync
    const persistedLength = persistedMessages.length;
    const lastMessage = persistedMessages[persistedLength - 1];
    const lastSynced = lastSyncedRef.current;

    // Quick check: different message count or different last message ID
    if (
      persistedLength !== lastSynced.length ||
      lastMessage?.id !== lastSynced.lastMessageId
    ) {
      const partsHash = lastMessage ? JSON.stringify(lastMessage.parts) : null;
      lastSyncedRef.current = {
        length: persistedLength,
        lastMessageId: lastMessage?.id ?? null,
        partsHash,
      };
      startTransition(() => {
        setMessages(persistedMessages as unknown as UIMessage[]);
      });
      return;
    }

    // Same message count and ID - only compare parts if potentially changed (streaming updates)
    if (lastMessage && lastSynced.lastMessageId === lastMessage.id) {
      const partsHash = JSON.stringify(lastMessage.parts);
      if (partsHash !== lastSynced.partsHash) {
        lastSyncedRef.current = { ...lastSynced, partsHash };
        startTransition(() => {
          setMessages(persistedMessages as unknown as UIMessage[]);
        });
      }
    }
  }, [conversationId, persistedMessages, setMessages, status]);

  // Scroll to bottom when conversation is first loaded or page is refreshed
  useLayoutEffect(() => {
    if (!shouldScrollToBottomOnLoadRef.current || messages.length === 0) {
      return;
    }

    shouldScrollToBottomOnLoadRef.current = false;

    // Small delay to ensure DOM is ready
    setTimeout(() => {
      const container = scrollContainerRef.current;
      if (!container) return;

      // Instantly scroll to bottom (no animation for initial load)
      container.scrollTop = container.scrollHeight;
    }, 0);
  }, [messages]);

  // Track the message ID we're scrolling to (to avoid cleanup issues)
  const scrollToMessageIdRef = useRef<string | null>(null);

  // Scroll to show user message at top of viewport when sending a new message
  useLayoutEffect(() => {
    if (!shouldScrollToUserMessageRef.current || messages.length === 0) {
      return;
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "user") {
      return; // Don't reset flag here - we might still be waiting to scroll
    }

    // Mark which message we want to scroll to
    const targetMessageId = lastMessage.id;

    // If we're already trying to scroll to this message, don't set another timeout
    if (scrollToMessageIdRef.current === targetMessageId) {
      return;
    }

    scrollToMessageIdRef.current = targetMessageId;
    shouldScrollToUserMessageRef.current = false; // Reset flag immediately

    // Use setTimeout without cleanup - we want this to fire even if messages changes
    setTimeout(() => {
      const container = scrollContainerRef.current;
      if (!container) {
        scrollToMessageIdRef.current = null;
        return;
      }

      const targetMessage = container.querySelector(
        `[data-role="user"][data-message-id="${targetMessageId}"]`
      ) as HTMLElement;
      const messageToScroll =
        targetMessage ||
        (container.querySelectorAll('[data-role="user"]')[
          container.querySelectorAll('[data-role="user"]').length - 1
        ] as HTMLElement);

      if (messageToScroll) {
        // Custom smooth scroll with easing
        const scrollMargin = 30; // matches scrollMarginTop on user messages
        const targetScrollTop = messageToScroll.offsetTop - scrollMargin;
        const startScrollTop = container.scrollTop;
        const distance = targetScrollTop - startScrollTop;

        // Skip animation if already at target
        if (Math.abs(distance) < 1) {
          scrollToMessageIdRef.current = null;
          return;
        }

        // Duration scales with distance (min 200ms, max 600ms)
        const duration = Math.min(600, Math.max(200, Math.abs(distance) * 0.5));
        const startTime = performance.now();

        const animateScroll = (currentTime: number) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const easedProgress = easeInOutCubic(progress);

          container.scrollTop = startScrollTop + distance * easedProgress;

          if (progress < 1) {
            requestAnimationFrame(animateScroll);
          }
        };

        requestAnimationFrame(animateScroll);
      }

      scrollToMessageIdRef.current = null;
    }, 150);
  }, [messages]);

  const handleSend = useCallback(
    async (
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
    ) => {
      // Flag to scroll to user message after it's added (unless stayInPlace is true)
      shouldScrollToUserMessageRef.current = !options?.stayInPlace;

      // Build message parts
      const parts: UIMessage["parts"] = [];

      if (content.trim()) {
        parts.push({ type: "text" as const, text: content });
      }

      for (const attachment of attachments) {
        parts.push({
          type: "file" as const,
          mediaType: attachment.mediaType,
          url: attachment.url,
          storageId: attachment.storageId,
          fileName: attachment.fileName,
          fileSize: attachment.fileSize,
        });
      }

      // Send message (hook handles conversation creation if needed)
      await sendMessage(
        { role: "user", parts },
        { webSearchEnabled: options?.webSearchEnabled }
      );

      // Track analytics
      analytics.trackMessageSent({
        conversationId: conversationId ?? undefined,
        model: selectedModel,
        provider: modelInfo.provider,
        reasoningLevel,
        reasoningEnabled:
          reasoningLevel !== undefined && reasoningLevel !== "off",
        webSearchEnabled: options?.webSearchEnabled,
        attachmentsCount: attachments.length,
        messageLength: content.length,
      });
    },
    [
      sendMessage,
      analytics,
      conversationId,
      selectedModel,
      modelInfo.provider,
      reasoningLevel,
    ]
  );

  const handleStop = useCallback(() => {
    stop();
    analytics.trackStreamStopped(conversationId ?? "", "user_abort");
  }, [stop, analytics, conversationId]);

  const handleRegenerate = useCallback(
    (
      messageId: string,
      model?: string,
      reasoningLevelOverride?: string | number
    ) => {
      // Scroll to show the regenerated user message
      shouldScrollToUserMessageRef.current = true;

      // Update current configuration to match what's being regenerated
      if (model && model !== selectedModel) {
        onModelChange(model);
      }
      if (reasoningLevelOverride !== undefined) {
        onReasoningLevelChange(reasoningLevelOverride);
      }

      regenerate({ messageId, model, reasoningLevel: reasoningLevelOverride });

      const effectiveModel = model ?? selectedModel;
      analytics.trackMessageRegenerated({
        conversationId: conversationId ?? undefined,
        model: effectiveModel,
        provider: getModelInfo(effectiveModel).provider,
        reasoningLevel: reasoningLevelOverride ?? reasoningLevel,
      });
    },
    [
      regenerate,
      selectedModel,
      onModelChange,
      onReasoningLevelChange,
      analytics,
      conversationId,
      reasoningLevel,
    ]
  );

  const handleEdit = useCallback(
    async (
      messageId: string,
      newContent: string,
      attachments: FilePart[],
      options?: {
        model?: string;
        reasoningLevel?: string | number;
        webSearchEnabled?: boolean;
      }
    ) => {
      // Scroll to show the edited user message
      shouldScrollToUserMessageRef.current = true;

      // Update UI state to match the edit config
      if (options?.model && options.model !== selectedModel) {
        onModelChange(options.model);
      }
      if (options?.reasoningLevel !== undefined) {
        onReasoningLevelChange(options.reasoningLevel);
      }
      if (options?.webSearchEnabled !== undefined) {
        onWebSearchEnabledChange(options.webSearchEnabled);
      }

      await editAndResend(messageId, newContent, attachments, options);

      const effectiveModel = options?.model ?? selectedModel;
      analytics.trackMessageEdited({
        conversationId: conversationId ?? undefined,
        model: effectiveModel,
        provider: getModelInfo(effectiveModel).provider,
        reasoningLevel: options?.reasoningLevel ?? reasoningLevel,
        webSearchEnabled: options?.webSearchEnabled,
        attachmentsCount: attachments.length,
        messageLength: newContent.length,
      });
    },
    [
      editAndResend,
      selectedModel,
      onModelChange,
      onReasoningLevelChange,
      onWebSearchEnabledChange,
      analytics,
      conversationId,
      reasoningLevel,
    ]
  );

  const handleFork = useCallback(
    async (messageId: string) => {
      const newConversationId = await forkConversation(messageId);
      if (newConversationId) {
        analytics.trackConversationForked(
          conversationId ?? "",
          newConversationId
        );
        onFork?.(newConversationId);
      }
    },
    [forkConversation, onFork, analytics, conversationId]
  );

  const isLoading = status === "submitted" || status === "streaming";
  const isNewChat = !conversationId && messages.length === 0;

  // Chat input component (reused in both views)
  const chatInput = (
    <ChatInput
      ref={effectiveChatInputRef}
      key={conversationId ?? `new-${newChatResetKey}`}
      onSend={handleSend}
      onStop={handleStop}
      isLoading={isLoading}
      conversationId={conversationId}
      selectedModel={selectedModel}
      onModelChange={handleModelChange}
      reasoningLevel={reasoningLevel}
      onReasoningLevelChange={onReasoningLevelChange}
      isAuthenticated={isAuthenticated}
      initialDraft={initialNewChatDraft}
      canSend={sendRestriction.canSend}
      sendBlockedReason={sendRestriction.reason}
      webSearchEnabled={webSearchEnabled}
      onWebSearchToggle={onWebSearchEnabledChange}
      modelSupportsWebSearch={modelSupportsWebSearch}
      canUseWebSearch={canUseWebSearch}
    />
  );

  // New chat view (empty state)
  if (isNewChat) {
    return (
      <div
        className="relative flex flex-col items-center px-4 pt-[25vh] h-full"
        style={{ backgroundColor: "var(--color-background-primary)" }}
        {...dropHandlers}
      >
        <DropZoneOverlay isVisible={isDragging} />
        <div className="w-full max-w-3xl">
          <h1
            className="mb-4 font-medium text-2xl text-center"
            style={{ color: "var(--color-text-primary)" }}
          >
            Let's get started!
          </h1>
          {chatInput}
        </div>
      </div>
    );
  }

  // Existing chat view
  return (
    <div
      className="relative flex flex-col h-full"
      style={{ backgroundColor: "var(--color-background-primary)" }}
      {...dropHandlers}
    >
      <DropZoneOverlay isVisible={isDragging} />

      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        className="flex flex-1 justify-center overflow-y-auto"
      >
        <div className="px-4 pt-16 w-full max-w-3xl">
          <MessageList
            ref={messageListRef}
            messages={messages}
            status={status}
            onEdit={handleEdit}
            onRegenerate={handleRegenerate}
            onFork={handleFork}
            currentModel={selectedModel}
            isAuthenticated={isAuthenticated}
          />
        </div>
      </div>

      {/* Input area */}
      <div
        className="flex justify-center px-4 pb-4"
        style={{ backgroundColor: "var(--color-background-primary)" }}
      >
        <div className="w-full max-w-3xl">{chatInput}</div>
      </div>
    </div>
  );
}
