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
  isMobile?: boolean;
  isTablet?: boolean;
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
  isMobile = false,
  isTablet = false,
}: SidebarProps) {
  const [isResizing, setIsResizing] = useState(false);
  const [isMac, setIsMac] = useState(true);
  const sidebarRef = useRef<HTMLElement>(null);
  const floatingSidebarRef = useRef<HTMLElement>(null);
  const hoverDelayRef = useRef<NodeJS.Timeout | null>(null);

  // use props from parent instead of local state for responsive behavior
  const isSmallScreen = isMobile || isTablet;

  // check user state to determine sidebar button (sign up / subscribe / settings)
  // in self-hosting mode, always show "settings" (no sign-in/billing needed)
  const { isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(
    api.settings.getCurrentUser,
    isAuthenticated ? {} : "skip"
  );
  const tierInfo = useQuery(
    api.billing.getUserTier,
    IS_SELF_HOSTING_CLIENT ? "skip" : {}
  );

  // determine button state: anonymous → "sign up", non-subscriber → "subscribe", subscriber → "settings"
  const isAnonymousUser = IS_SELF_HOSTING_CLIENT
    ? false
    : !isAuthenticated || currentUser?.isAnonymous;
  // must match settingsModal's definition to ensure consistent behavior
  const isFullyAuthenticated =
    isAuthenticated && currentUser?.emailVerified && !currentUser?.isAnonymous;
  const isSubscriber = IS_SELF_HOSTING_CLIENT
    ? true
    : tierInfo?.tier === "subscriber";
  // use isFullyAuthenticated (not just !isAnonymousUser) to match settingsModal logic
  const isSignedInNonSubscriber =
    !IS_SELF_HOSTING_CLIENT && isFullyAuthenticated && !isSubscriber;

  // detect mac vs windows
  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0);
  }, []);

  // whether to hide floating buttons (small screen + right sidebar)
  const hideFloatingButtons = isSmallScreen && side === "right";

  // get formatted shortcuts based on current keybinds and sidebar position
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

  // handle resize
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

  // handle floating sidebar visibility with delay
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

  // cleanup hover delay timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverDelayRef.current) {
        clearTimeout(hoverDelayRef.current);
      }
    };
  }, []);

  // sidebar content (shared between normal and floating) - memoized to prevent scroll reset
  const sidebarContent = useMemo(
    () => (
      <TooltipProvider delayDuration={1000}>
        <div className="flex flex-col h-full">
          {/* header */}
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

          {/* new chat button */}
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

          {/* search button */}
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

          {/* conversation list */}
          <div className="flex-1 px-2 overflow-y-auto">
            <ConversationList
              currentConversationId={currentConversationId}
              onSelect={onConversationSelect}
            />
          </div>

          {/* footer */}
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
      {/* mobile sidebar overlay backdrop */}
      {isMobile && !collapsed && (
        <div
          className="z-40 fixed inset-0 bg-black/50 transition-opacity duration-200"
          onClick={() => onCollapsedChange(true)}
        />
      )}

      {/* normal sidebar (expanded) - renders as overlay on mobile */}
      <aside
        ref={sidebarRef}
        className={cn(
          "h-full overflow-hidden",
          // mobile: fixed overlay
          isMobile
            ? cn(
                "z-50 fixed top-0 bottom-0 shadow-2xl",
                side === "left" ? "left-0" : "right-0",
                collapsed
                  ? side === "left"
                    ? "-translate-x-full"
                    : "translate-x-full"
                  : "translate-x-0",
                "transition-transform duration-300 ease-out"
              )
            : cn(
                // desktop/tablet: relative with border
                "relative",
                side === "left" ? "border-r" : "border-l",
                collapsed ? "w-0 opacity-0" : "opacity-100",
                !isResizing &&
                  "transition-[width,opacity] duration-300 ease-out"
              )
        )}
        style={{
          backgroundColor: "var(--color-background-secondary)",
          borderColor: isMobile ? undefined : "var(--color-border-default)",
          width: isMobile ? "85vw" : collapsed ? 0 : width,
          maxWidth: isMobile ? "320px" : undefined,
        }}
      >
        {/* fixed-width inner container - content doesn't resize during animation */}
        <div
          className="flex flex-col h-full"
          style={{ width: isMobile ? "100%" : width }}
        >
          {sidebarContent}

          {/* resize handle - desktop only */}
          {!isMobile && (
            <div
              onMouseDown={handleMouseDown}
              className={cn(
                "top-0 z-10 absolute w-1 h-full cursor-col-resize",
                side === "left" ? "right-0" : "left-0",
                "hover:bg-[var(--color-accent-primary)] transition-colors",
                isResizing && "bg-[var(--color-accent-primary)]"
              )}
            />
          )}
        </div>
      </aside>

      {/* hover trigger zone for floating sidebar (collapsed state) - desktop/tablet only */}
      {collapsed && !isMobile && (
        <div
          className={cn(
            "top-16 z-40 fixed w-24 h-[calc(100%-8rem)]",
            side === "left" ? "left-0" : "right-0"
          )}
          onMouseEnter={handleFloatingAreaEnter}
          onMouseLeave={handleFloatingAreaLeave}
        />
      )}

      {/* floating action bar (collapsed state) */}
      {collapsed && (
        <TooltipProvider delayDuration={1000}>
          <div
            className={cn(
              "top-3 z-40 fixed flex items-center shadow-sm border rounded-sm",
              // touch-friendly sizing on mobile
              isMobile ? "gap-1 p-1" : "gap-1 p-1.5",
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
                  className={cn(
                    "flex justify-center items-center hover:bg-[var(--color-background-hover)] rounded-sm transition-colors",
                    // touch-friendly: 44x44px on mobile, 32x32px on desktop
                    isMobile ? "w-11 h-11" : "w-8 h-8"
                  )}
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <PanelLeft className={isMobile ? "w-5 h-5" : "w-4 h-4"} />
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
                      className={cn(
                        "flex justify-center items-center hover:bg-[var(--color-background-hover)] rounded-sm transition-colors",
                        isMobile ? "w-11 h-11" : "w-8 h-8"
                      )}
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      <Search className={isMobile ? "w-5 h-5" : "w-4 h-4"} />
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
                      className={cn(
                        "flex justify-center items-center hover:bg-[var(--color-background-hover)] rounded-sm transition-colors",
                        isMobile ? "w-11 h-11" : "w-8 h-8"
                      )}
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      <Plus className={isMobile ? "w-5 h-5" : "w-4 h-4"} />
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

      {/* floating sidebar overlay (hover state when collapsed) - desktop/tablet only */}
      {collapsed && !isMobile && (
        <>
          {/* backdrop */}
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

          {/* floating sidebar */}
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

      {/* bottom floating buttons (collapsed state) */}
      {collapsed && !hideFloatingButtons && (
        <TooltipProvider delayDuration={1000}>
          <div
            className={cn(
              "bottom-3 z-40 fixed flex items-center shadow-sm border rounded-sm",
              isMobile ? "gap-1 p-1" : "gap-1 p-1.5",
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
                  className={cn(
                    "flex justify-center items-center hover:bg-[var(--color-background-hover)] rounded-sm transition-colors",
                    isMobile ? "w-11 h-11" : "w-8 h-8"
                  )}
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {isAnonymousUser ? (
                    <LogIn className={isMobile ? "w-5 h-5" : "w-4 h-4"} />
                  ) : isSignedInNonSubscriber ? (
                    <CreditCard className={isMobile ? "w-5 h-5" : "w-4 h-4"} />
                  ) : (
                    <Settings className={isMobile ? "w-5 h-5" : "w-4 h-4"} />
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
                  className={cn(
                    "flex justify-center items-center hover:bg-[var(--color-background-hover)] rounded-sm transition-colors",
                    isMobile ? "w-11 h-11" : "w-8 h-8"
                  )}
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <Palette className={isMobile ? "w-5 h-5" : "w-4 h-4"} />
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
