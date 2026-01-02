"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  startTransition,
} from "react";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { Sidebar } from "@/components/layout/Sidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import {
  clearNewChatDraft,
  clearNewChatAttachmentDraft,
  setNewChatDraft,
  type ChatInputHandle,
} from "@/components/chat/ChatInput";
import type { MessageListHandle } from "@/components/chat/MessageList";
import { ThemeEditorPanel } from "@/components/theme-editor/ThemeEditorPanel";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useKeybinds } from "@/hooks/useKeybinds";
import { useAnalytics } from "@/hooks/useAnalytics";
import { CoresProvider } from "@/contexts/CoresContext";
import { FREE_MODEL_ID, getModelInfo } from "@/lib/models";
import { setCookie } from "@/lib/cookies";

const SIDEBAR_COLLAPSED_COOKIE = "ourin-sidebar-collapsed";
const SIDEBAR_WIDTH_COOKIE = "ourin-sidebar-width";
const SIDEBAR_SIDE_COOKIE = "ourin-sidebar-side";
const THEME_EDITOR_OPEN_COOKIE = "ourin-theme-editor-open";
const SELECTED_MODEL_COOKIE = "ourin-selected-model";
const REASONING_LEVEL_COOKIE = "ourin-reasoning-level";
const WEB_SEARCH_ENABLED_COOKIE = "ourin-web-search-enabled";

interface HomeClientProps {
  initialConversationId?: string;
  initialSidebarCollapsed: boolean;
  initialSidebarWidth: number;
  initialSidebarSide?: "left" | "right";
  initialThemeEditorOpen: boolean;
  initialActiveCoresCount?: number;
  initialNewChatDraft?: string;
  initialSelectedModel?: string;
  initialReasoningLevel?: string | number;
  initialWebSearchEnabled?: boolean;
  initialUserTier?: string;
}

export function HomeClient({
  initialConversationId,
  initialSidebarCollapsed,
  initialSidebarWidth,
  initialSidebarSide = "left",
  initialThemeEditorOpen,
  initialActiveCoresCount = 2,
  initialNewChatDraft = "",
  initialSelectedModel = "google:gemini-2.5-flash-lite",
  initialReasoningLevel,
  initialWebSearchEnabled = false,
  initialUserTier,
}: HomeClientProps) {
  // Auth state for model restriction
  const { isAuthenticated } = useConvexAuth();
  const analytics = useAnalytics();
  const wasAuthenticatedRef = useRef<boolean | null>(null);

  // Sidebar state - initialize from server-provided props (no flash)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    initialSidebarCollapsed
  );
  const [sidebarWidth, setSidebarWidth] = useState(initialSidebarWidth);
  const [sidebarSide, setSidebarSide] = useState<"left" | "right">(
    initialSidebarSide
  );

  // Panel states - initialize from server-provided prop (no flash)
  const [showThemeEditor, setShowThemeEditor] = useState(
    initialThemeEditorOpen
  );
  const [showSettings, setShowSettings] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  // Ref to ChatInput for programmatic file insertion
  const chatInputRef = useRef<ChatInputHandle>(null);

  // Ref to MessageList for programmatic file insertion when in edit mode
  const messageListRef = useRef<MessageListHandle>(null);

  // Mutation for deleting orphaned files when clearing new chat
  const deleteFile = useMutation(api.files.deleteFile);

  // Model state - initialize from server-provided prop (no flash)
  const [selectedModel, setSelectedModel] = useState(initialSelectedModel);

  // Reasoning level state - initialize from server-provided prop (no flash)
  const [reasoningLevel, setReasoningLevel] = useState<string | number>(
    initialReasoningLevel ?? "medium"
  );

  // Web search state - initialize from server-provided prop (no flash)
  const [webSearchEnabled, setWebSearchEnabled] = useState(
    initialWebSearchEnabled
  );

  // Reset model to free tier when user logs out with a premium model selected
  useEffect(() => {
    // Skip on first render (auth state may be loading)
    if (wasAuthenticatedRef.current === null) {
      wasAuthenticatedRef.current = isAuthenticated;
      return;
    }

    // Detect logout: was authenticated, now not authenticated
    if (wasAuthenticatedRef.current && !isAuthenticated) {
      // If user had a non-free model selected, reset to free model
      if (selectedModel !== FREE_MODEL_ID) {
        setSelectedModel(FREE_MODEL_ID);
      }
    }

    wasAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated, selectedModel]);

  // Floating sidebar state (lifted up to prevent reset during navigation)
  const [showFloatingSidebar, setShowFloatingSidebar] = useState(false);

  // Key to force ChatInput reset when clicking "New Chat" while already on new chat
  const [newChatResetKey, setNewChatResetKey] = useState(0);

  // Persist UI state to cookies (read server-side to prevent flash)
  useEffect(() => {
    setCookie(SIDEBAR_COLLAPSED_COOKIE, sidebarCollapsed);
  }, [sidebarCollapsed]);

  useEffect(() => {
    setCookie(SIDEBAR_WIDTH_COOKIE, sidebarWidth);
  }, [sidebarWidth]);

  useEffect(() => {
    setCookie(SIDEBAR_SIDE_COOKIE, sidebarSide);
  }, [sidebarSide]);

  useEffect(() => {
    setCookie(THEME_EDITOR_OPEN_COOKIE, showThemeEditor);
  }, [showThemeEditor]);

  useEffect(() => {
    setCookie(SELECTED_MODEL_COOKIE, selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    setCookie(REASONING_LEVEL_COOKIE, reasoningLevel);
  }, [reasoningLevel]);

  useEffect(() => {
    setCookie(WEB_SEARCH_ENABLED_COOKIE, webSearchEnabled);
  }, [webSearchEnabled]);

  // Current conversation (from URL or null = new chat)
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(initialConversationId || null);

  // Fetch current conversation for title
  const currentConversation = useQuery(
    api.conversations.get,
    currentConversationId
      ? { id: currentConversationId as Id<"conversations"> }
      : "skip"
  );

  // Dynamic document title based on conversation
  useEffect(() => {
    if (currentConversationId && currentConversation) {
      const title = currentConversation.title || "New conversation";
      document.title = `${title} - Ourin`;
    } else if (!currentConversationId) {
      document.title = "Ourin | The modern AI chat";
    }
  }, [currentConversationId, currentConversation]);

  // Handle conversation selection - update URL without full navigation
  // Uses startTransition to keep UI responsive during heavy re-renders
  const handleConversationSelect = useCallback((id: string | null) => {
    // Update URL immediately for instant feedback
    if (id) {
      window.history.pushState(null, "", `/c/${id}`);
    } else {
      window.history.pushState(null, "", "/");
    }
    // Defer state update to keep click handler fast
    startTransition(() => {
      setCurrentConversationId(id);
    });
  }, []);

  // Sync state with URL when user navigates with browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const match = path.match(/^\/c\/(.+)$/);
      startTransition(() => {
        setCurrentConversationId(match ? match[1] : null);
      });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Handle new conversation creation - update URL without full navigation
  const handleConversationCreate = useCallback(
    (id: string) => {
      setCurrentConversationId(id);
      analytics.trackConversationCreated(id, selectedModel);
      // Use replaceState to update URL without triggering re-render
      window.history.replaceState(null, "", `/c/${id}`);
    },
    [analytics, selectedModel]
  );

  // Handle new chat - update URL without full navigation
  const handleNewChat = useCallback(() => {
    setCurrentConversationId(null);
    setNewChatResetKey((k) => k + 1);
    window.history.pushState(null, "", "/");
  }, []);

  // Handle fork - update URL without full navigation
  const handleFork = useCallback((newConversationId: string) => {
    setCurrentConversationId(newConversationId);
    window.history.pushState(null, "", `/c/${newConversationId}`);
    toast.success("Forked!");
  }, []);

  // Handle new chat with pre-filled message (from command palette)
  // Sets the draft and triggers auto-send
  const handleNewChatWithMessage = useCallback(
    (message: string) => {
      // Clear any existing attachments
      const storageIdsToDelete = clearNewChatAttachmentDraft();
      for (const storageId of storageIdsToDelete) {
        deleteFile({ storageId: storageId as Id<"_storage"> }).catch(() => {});
      }
      // Set the draft with the message and flag for auto-send
      setNewChatDraft(message, true);
      setCurrentConversationId(null);
      setNewChatResetKey((k) => k + 1);
      window.history.pushState(null, "", "/");
    },
    [deleteFile]
  );

  // Memoized toggle callbacks - reused across keyboard shortcuts and JSX
  const toggleSidebar = useCallback(
    () => setSidebarCollapsed((prev) => !prev),
    []
  );
  const toggleSettings = useCallback(
    () => setShowSettings((prev) => !prev),
    []
  );
  const toggleThemeEditor = useCallback(
    () => setShowThemeEditor((prev) => !prev),
    []
  );
  const toggleCommandPalette = useCallback(
    () => setShowCommandPalette((prev) => !prev),
    []
  );
  const openSettings = useCallback(() => setShowSettings(true), []);
  const openCommandPalette = useCallback(() => setShowCommandPalette(true), []);
  const closeSettings = useCallback(() => setShowSettings(false), []);
  const closeThemeEditor = useCallback(() => setShowThemeEditor(false), []);
  const closeCommandPalette = useCallback(
    () => setShowCommandPalette(false),
    []
  );
  const flipSidebar = useCallback(
    () => setSidebarSide((prev) => (prev === "left" ? "right" : "left")),
    []
  );
  const openSettingsFromPalette = useCallback(() => {
    setShowCommandPalette(false);
    setShowSettings(true);
  }, []);

  // Model change with analytics
  const handleModelChange = useCallback(
    (newModel: string) => {
      if (newModel !== selectedModel) {
        analytics.trackModelChanged(
          selectedModel,
          newModel,
          getModelInfo(newModel).provider
        );
      }
      setSelectedModel(newModel);
    },
    [selectedModel, analytics]
  );

  // Get user's keybind configuration
  const keybinds = useKeybinds();

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onToggleSidebar: toggleSidebar,
    onNewChat: handleNewChat,
    onToggleSettings: toggleSettings,
    onToggleAppearance: toggleThemeEditor,
    onCommandPalette: toggleCommandPalette,
    keybinds,
    sidebarSide,
  });

  const sidebarElement = (
    <Sidebar
      collapsed={sidebarCollapsed}
      onCollapsedChange={setSidebarCollapsed}
      width={sidebarWidth}
      onWidthChange={setSidebarWidth}
      side={sidebarSide}
      currentConversationId={currentConversationId}
      onConversationSelect={handleConversationSelect}
      onNewChat={handleNewChat}
      onOpenAppearance={toggleThemeEditor}
      onOpenSettings={openSettings}
      onOpenCommandPalette={openCommandPalette}
      showFloatingSidebar={showFloatingSidebar}
      onShowFloatingSidebarChange={setShowFloatingSidebar}
      keybinds={keybinds}
    />
  );

  const themeEditorElement = (
    <ThemeEditorPanel
      isOpen={showThemeEditor}
      onClose={closeThemeEditor}
      side={sidebarSide === "left" ? "right" : "left"}
      onFlipSidebar={flipSidebar}
    />
  );

  const mainContent = (
    <main className="flex flex-col flex-1 w-full min-w-0">
      <ChatArea
        conversationId={currentConversationId}
        onConversationCreate={handleConversationCreate}
        onFork={handleFork}
        selectedModel={selectedModel}
        onModelChange={handleModelChange}
        initialNewChatDraft={initialNewChatDraft}
        newChatResetKey={newChatResetKey}
        reasoningLevel={reasoningLevel}
        onReasoningLevelChange={setReasoningLevel}
        webSearchEnabled={webSearchEnabled}
        onWebSearchEnabledChange={setWebSearchEnabled}
        initialUserTier={initialUserTier}
        chatInputRef={chatInputRef}
        messageListRef={messageListRef}
      />
    </main>
  );

  return (
    <CoresProvider initialActiveCoresCount={initialActiveCoresCount}>
      <div
        className="flex h-screen overflow-hidden"
        style={{ backgroundColor: "var(--color-background-primary)" }}
      >
        {sidebarSide === "left" ? (
          <>
            {sidebarElement}
            {mainContent}
            {themeEditorElement}
          </>
        ) : (
          <>
            {themeEditorElement}
            {mainContent}
            {sidebarElement}
          </>
        )}

        {/* Settings modal */}
        <SettingsModal isOpen={showSettings} onClose={closeSettings} />

        {/* Command palette */}
        <CommandPalette
          isOpen={showCommandPalette}
          onClose={closeCommandPalette}
          onNewChatWithMessage={handleNewChatWithMessage}
          onConversationSelect={handleConversationSelect}
          onOpenSettings={openSettingsFromPalette}
          onToggleSidebar={toggleSidebar}
          onOpenAppearance={toggleThemeEditor}
          currentConversationId={currentConversationId}
          sidebarSide={sidebarSide}
        />
      </div>
    </CoresProvider>
  );
}
