"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  PanelLeft,
  Plus,
  Search,
  Palette,
  Settings,
  LogIn,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConversationList } from "@/components/sidebar/ConversationList";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/Tooltip";
import { KeybindsMap, formatKeybind } from "@/lib/keybinds";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { IS_SELF_HOSTING_CLIENT } from "@/lib/config";

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  width: number;
  onWidthChange: (width: number) => void;
  side?: "left" | "right";
  currentConversationId: string | null;
  onConversationSelect: (id: string | null) => void;
  onNewChat: () => void;
  onOpenAppearance: () => void;
  onOpenSettings: () => void;
  onOpenCommandPalette: () => void;
  showFloatingSidebar: boolean;
  onShowFloatingSidebarChange: (show: boolean) => void;
  keybinds: KeybindsMap;
}

export function Sidebar({
  collapsed,
  onCollapsedChange,
  width,
  onWidthChange,
  side = "left",
  currentConversationId,
  onConversationSelect,
  onNewChat,
  onOpenAppearance,
  onOpenSettings,
  onOpenCommandPalette,
  showFloatingSidebar,
  onShowFloatingSidebarChange,
  keybinds,
}: SidebarProps) {
  const [isResizing, setIsResizing] = useState(false);
  const [isMac, setIsMac] = useState(true);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const floatingSidebarRef = useRef<HTMLElement>(null);
  const hoverDelayRef = useRef<NodeJS.Timeout | null>(null);

  // Check user state to determine sidebar button (Sign up / Subscribe / Settings)
  // In self-hosting mode, always show "Settings" (no sign-in/billing needed)
  const { isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(
    api.settings.getCurrentUser,
    isAuthenticated ? {} : "skip"
  );
  const tierInfo = useQuery(
    api.billing.getUserTier,
    IS_SELF_HOSTING_CLIENT ? "skip" : {}
  );

  // Determine button state: anonymous → "Sign up", non-subscriber → "Subscribe", subscriber → "Settings"
  const isAnonymousUser = IS_SELF_HOSTING_CLIENT
    ? false
    : !isAuthenticated || currentUser?.isAnonymous;
  // Must match SettingsModal's definition to ensure consistent behavior
  const isFullyAuthenticated =
    isAuthenticated && currentUser?.emailVerified && !currentUser?.isAnonymous;
  const isSubscriber = IS_SELF_HOSTING_CLIENT
    ? true
    : tierInfo?.tier === "subscriber";
  // Use isFullyAuthenticated (not just !isAnonymousUser) to match SettingsModal logic
  const isSignedInNonSubscriber =
    !IS_SELF_HOSTING_CLIENT && isFullyAuthenticated && !isSubscriber;

  // Detect Mac vs Windows
  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0);
  }, []);

  // Detect small screen for responsive tab layout
  useEffect(() => {
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 1045);
    };
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  // Whether to hide floating buttons (small screen + right sidebar)
  const hideFloatingButtons = isSmallScreen && side === "right";

  // Get formatted shortcuts based on current keybinds and sidebar position
  const shortcuts = useMemo(
    () => ({
      sidebar: formatKeybind(
        side === "left"
          ? keybinds.toggleSidebarLeft
          : keybinds.toggleSidebarRight,
        isMac
      ),
      newChat: formatKeybind(keybinds.newChat, isMac),
      settings: formatKeybind(keybinds.settings, isMac),
      appearance: formatKeybind(keybinds.appearance, isMac),
      commandPalette: formatKeybind(keybinds.commandPalette, isMac),
    }),
    [keybinds, side, isMac]
  );

  // Handle resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      let newWidth: number;
      if (side === "left") {
        newWidth = Math.max(200, Math.min(400, e.clientX));
      } else {
        newWidth = Math.max(200, Math.min(400, window.innerWidth - e.clientX));
      }
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, onWidthChange, side]);

  // Handle floating sidebar visibility with delay
  const handleFloatingAreaEnter = useCallback(() => {
    if (collapsed) {
      hoverDelayRef.current = setTimeout(() => {
        onShowFloatingSidebarChange(true);
      }, 200);
    }
  }, [collapsed, onShowFloatingSidebarChange]);

  const handleFloatingAreaLeave = useCallback(() => {
    if (hoverDelayRef.current) {
      clearTimeout(hoverDelayRef.current);
      hoverDelayRef.current = null;
    }
  }, []);

  // Cleanup hover delay timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverDelayRef.current) {
        clearTimeout(hoverDelayRef.current);
      }
    };
  }, []);

  // Sidebar content (shared between normal and floating) - memoized to prevent scroll reset
  const sidebarContent = useMemo(
    () => (
      <TooltipProvider delayDuration={1000}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex justify-between items-center px-4 pt-3 pb-1">
            <span
              className="font-bold text-lg tracking-tight"
              style={{ color: "var(--color-text-primary)" }}
            >
              Ourin
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onCollapsedChange(!collapsed)}
                  className="hover:bg-[var(--color-background-hover)] p-1.5 rounded-sm transition-colors"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <PanelLeft className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <span>Toggle sidebar</span>
                <span className="opacity-60 ml-2">{shortcuts.sidebar}</span>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* New Chat button */}
          <div className="px-2 pt-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onNewChat}
                  className="flex items-center gap-2 hover:bg-[var(--color-background-hover)] px-2 py-2 rounded-sm w-full font-medium text-sm transition-colors"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <Plus className="w-4 h-4 shrink-0" strokeWidth={2} />
                  <span>New Chat</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <span>New chat</span>
                <span className="opacity-60 ml-2">{shortcuts.newChat}</span>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Search button */}
          <div className="px-2 pb-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onOpenCommandPalette}
                  className="flex items-center gap-2 hover:bg-[var(--color-background-hover)] px-2 py-2 rounded-sm w-full font-medium text-sm transition-colors"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <Search className="w-4 h-4 shrink-0" />
                  <span>Search</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <span>Search</span>
                <span className="opacity-60 ml-2">
                  {shortcuts.commandPalette}
                </span>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Conversation list */}
          <div className="flex-1 px-2 overflow-y-auto">
            <ConversationList
              currentConversationId={currentConversationId}
              onSelect={onConversationSelect}
            />
          </div>

          {/* Footer */}
          <div
            className="px-2 py-2"
            style={{ borderColor: "var(--color-border-muted)" }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onOpenAppearance}
                  className="flex items-center gap-2 hover:bg-[var(--color-background-hover)] px-2 py-2 rounded-sm w-full transition-colors"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <Palette className="w-4 h-4 shrink-0" />
                  <span className="font-medium text-sm">Appearance</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <span>Appearance</span>
                <span className="opacity-60 ml-2">{shortcuts.appearance}</span>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onOpenSettings}
                  className="flex items-center gap-2 hover:bg-[var(--color-background-hover)] px-2 py-2 rounded-sm w-full transition-colors"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {isAnonymousUser ? (
                    <>
                      <LogIn className="w-4 h-4 shrink-0" />
                      <span className="font-medium text-sm">Sign up</span>
                    </>
                  ) : isSignedInNonSubscriber ? (
                    <>
                      <CreditCard className="w-4 h-4 shrink-0" />
                      <span className="font-medium text-sm">Subscribe</span>
                    </>
                  ) : (
                    <>
                      <Settings className="w-4 h-4 shrink-0" />
                      <span className="font-medium text-sm">Settings</span>
                    </>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <span>
                  {isAnonymousUser
                    ? "Sign up"
                    : isSignedInNonSubscriber
                      ? "Subscribe"
                      : "Settings"}
                </span>
                <span className="opacity-60 ml-2">{shortcuts.settings}</span>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </TooltipProvider>
    ),
    [
      collapsed,
      currentConversationId,
      isAnonymousUser,
      isSignedInNonSubscriber,
      onCollapsedChange,
      onConversationSelect,
      onNewChat,
      onOpenCommandPalette,
      onOpenAppearance,
      onOpenSettings,
      shortcuts,
    ]
  );

  return (
    <>
      {/* Normal sidebar (expanded) */}
      <aside
        ref={sidebarRef}
        className={cn(
          "relative h-full overflow-hidden",
          side === "left" ? "border-r" : "border-l",
          collapsed ? "w-0 opacity-0" : "opacity-100",
          !isResizing && "transition-[width,opacity] duration-300 ease-out"
        )}
        style={{
          backgroundColor: "var(--color-background-secondary)",
          borderColor: "var(--color-border-default)",
          width: collapsed ? 0 : width,
        }}
      >
        {/* Fixed-width inner container - content doesn't resize during animation */}
        <div className="flex flex-col h-full" style={{ width }}>
          {sidebarContent}

          {/* Resize handle */}
          <div
            onMouseDown={handleMouseDown}
            className={cn(
              "top-0 z-10 absolute w-1 h-full cursor-col-resize",
              side === "left" ? "right-0" : "left-0",
              "hover:bg-[var(--color-accent-primary)] transition-colors",
              isResizing && "bg-[var(--color-accent-primary)]"
            )}
          />
        </div>
      </aside>

      {/* Hover trigger zone for floating sidebar (collapsed state) */}
      {collapsed && (
        <div
          className={cn(
            "top-16 z-40 fixed w-24 h-[calc(100%-8rem)]",
            side === "left" ? "left-0" : "right-0"
          )}
          onMouseEnter={handleFloatingAreaEnter}
          onMouseLeave={handleFloatingAreaLeave}
        />
      )}

      {/* Floating action bar (collapsed state) */}
      {collapsed && (
        <TooltipProvider delayDuration={1000}>
          <div
            className={cn(
              "top-3 z-40 fixed flex items-center gap-1 shadow-sm p-1.5 border rounded-sm",
              side === "left" ? "left-3" : "right-3 flex-row-reverse"
            )}
            style={{
              backgroundColor: "var(--color-background-elevated)",
              borderColor: "var(--color-border-default)",
            }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onCollapsedChange(false)}
                  className="flex justify-center items-center hover:bg-[var(--color-background-hover)] rounded-sm w-8 h-8 transition-colors"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <PanelLeft className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <span>Toggle sidebar</span>
                <span className="opacity-60 ml-2">{shortcuts.sidebar}</span>
              </TooltipContent>
            </Tooltip>
            {!hideFloatingButtons && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={onOpenCommandPalette}
                      className="flex justify-center items-center hover:bg-[var(--color-background-hover)] rounded-sm w-8 h-8 transition-colors"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      <Search className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <span>Search</span>
                    <span className="opacity-60 ml-2">
                      {shortcuts.commandPalette}
                    </span>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={onNewChat}
                      className="flex justify-center items-center hover:bg-[var(--color-background-hover)] rounded-sm w-8 h-8 transition-colors"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <span>New chat</span>
                    <span className="opacity-60 ml-2">{shortcuts.newChat}</span>
                  </TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </TooltipProvider>
      )}

      {/* Floating sidebar overlay (hover state when collapsed) */}
      {collapsed && (
        <>
          {/* Backdrop */}
          <div
            className={cn(
              "z-40 fixed inset-0",
              "transition-opacity duration-200",
              showFloatingSidebar
                ? "opacity-100"
                : "opacity-0 pointer-events-none"
            )}
            style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
            onMouseDown={() => onShowFloatingSidebarChange(false)}
          />

          {/* Floating sidebar */}
          <aside
            ref={floatingSidebarRef}
            className={cn(
              "top-3 bottom-3 z-50 fixed flex flex-col shadow-2xl border rounded-sm",
              side === "left" ? "left-3" : "right-3",
              "transition-[transform,opacity] duration-200 ease-out",
              showFloatingSidebar
                ? "translate-x-0 opacity-100"
                : side === "left"
                  ? "-translate-x-[calc(100%+12px)] opacity-0 pointer-events-none"
                  : "translate-x-[calc(100%+12px)] opacity-0 pointer-events-none"
            )}
            style={{
              backgroundColor: "var(--color-background-elevated)",
              borderColor: "var(--color-border-muted)",
              width: width,
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseLeave={() => onShowFloatingSidebarChange(false)}
          >
            {sidebarContent}
          </aside>
        </>
      )}

      {/* Bottom floating buttons (collapsed state) */}
      {collapsed && !hideFloatingButtons && (
        <TooltipProvider delayDuration={1000}>
          <div
            className={cn(
              "bottom-3 z-40 fixed flex items-center gap-1 shadow-sm p-1.5 border rounded-sm",
              side === "left" ? "left-3" : "right-3 flex-row-reverse"
            )}
            style={{
              backgroundColor: "var(--color-background-elevated)",
              borderColor: "var(--color-border-default)",
            }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onOpenSettings}
                  className="flex justify-center items-center hover:bg-[var(--color-background-hover)] rounded-sm w-8 h-8 transition-colors"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {isAnonymousUser ? (
                    <LogIn className="w-4 h-4" />
                  ) : isSignedInNonSubscriber ? (
                    <CreditCard className="w-4 h-4" />
                  ) : (
                    <Settings className="w-4 h-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <span>
                  {isAnonymousUser
                    ? "Sign up"
                    : isSignedInNonSubscriber
                      ? "Subscribe"
                      : "Settings"}
                </span>
                <span className="opacity-60 ml-2">{shortcuts.settings}</span>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onOpenAppearance}
                  className="flex justify-center items-center hover:bg-[var(--color-background-hover)] rounded-sm w-8 h-8 transition-colors"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <Palette className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <span>Appearance</span>
                <span className="opacity-60 ml-2">{shortcuts.appearance}</span>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      )}
    </>
  );
}
