"use client";

import { useEffect, useMemo, useCallback, useState, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Settings,
  PanelLeft,
  Palette,
  MessageSquare,
  Plus,
} from "lucide-react";
import { useCommandPalette, type SearchableItem } from "./useCommandPalette";
import { CommandPaletteItem } from "./CommandPaletteItem";
import { ThemeColorSwatch } from "./ThemeColorSwatch";
import { useKeybinds } from "@/hooks/useKeybinds";
import { formatKeybind } from "@/lib/keybinds";
import { useTheme } from "@/components/providers/ThemeProvider";
import type { OurinTheme } from "@ourin/core";
import { getThemeUsageTimestamps } from "./themeUsageTracker";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNewChatWithMessage: (message: string) => void;
  onConversationSelect: (id: string) => void;
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
  onOpenAppearance: () => void;
  currentConversationId?: string | null;
  sidebarSide: "left" | "right";
}

export function CommandPalette({
  isOpen,
  onClose,
  onNewChatWithMessage,
  onConversationSelect,
  onOpenSettings,
  onToggleSidebar,
  onOpenAppearance,
  currentConversationId,
  sidebarSide,
}: CommandPaletteProps) {
  // fetch conversations
  const conversations = useQuery(api.conversations.list, isOpen ? {} : "skip");

  // get keybinds from user settings
  const keybinds = useKeybinds();
  const [isMac, setIsMac] = useState(true);

  // theme context for inline theme switching
  const { themeId, setTheme, setCustomTheme, builtInThemes, customThemes } =
    useTheme();

  // track original theme when palette opens (for reverting on close)
  const originalThemeIdRef = useRef<string | null>(null);

  // capture original theme when opening
  useEffect(() => {
    if (isOpen) {
      originalThemeIdRef.current = themeId;
    }
  }, [isOpen, themeId]);

  // detect mac vs windows
  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0);
  }, []);

  // build searchable items
  const items: SearchableItem[] = useMemo(() => {
    const result: SearchableItem[] = [];

    // actions (new chat is handled by pressing enter on the query)
    result.push({
      id: "action-settings",
      label: "Settings",
      keywords: ["preferences", "config", "api", "keys", "account"],
      type: "action",
      icon: Settings,
      shortcut: formatKeybind(keybinds.settings, isMac),
    });

    result.push({
      id: "action-toggle-sidebar",
      label: "Toggle Sidebar",
      keywords: ["hide", "show", "collapse", "expand", "panel"],
      type: "action",
      icon: PanelLeft,
      shortcut: formatKeybind(
        sidebarSide === "left"
          ? keybinds.toggleSidebarLeft
          : keybinds.toggleSidebarRight,
        isMac
      ),
    });

    result.push({
      id: "action-appearance",
      label: "Appearance",
      keywords: ["theme", "dark", "light", "colors", "customize"],
      type: "action",
      icon: Palette,
      shortcut: formatKeybind(keybinds.appearance, isMac),
    });

    // themes (built-in + custom), sorted by most recently used
    const allThemes = [...builtInThemes, ...customThemes];
    const usageTimestamps = getThemeUsageTimestamps();

    // sort themes: recently used first, then by original order
    const sortedThemes = [...allThemes].sort((a, b) => {
      const aTime = usageTimestamps[a.id] || 0;
      const bTime = usageTimestamps[b.id] || 0;
      return bTime - aTime; // most recent first
    });

    for (const theme of sortedThemes) {
      result.push({
        id: `theme-${theme.id}`,
        label: theme.name,
        keywords: [
          theme.type,
          theme.type === "light" ? "bright" : "night",
          "theme",
          "appearance",
          "color",
        ],
        type: "theme",
        data: theme,
      });
    }

    // conversations
    if (conversations) {
      for (const conv of conversations) {
        // skip current conversation
        if (conv._id === currentConversationId) continue;

        result.push({
          id: `chat-${conv._id}`,
          label: conv.title || "Untitled conversation",
          type: "chat",
          icon: MessageSquare,
          data: conv._id,
        });
      }
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    conversations,
    currentConversationId,
    keybinds,
    isMac,
    sidebarSide,
    builtInThemes,
    customThemes,
    isOpen,
  ]);

  const {
    query,
    setQuery,
    selectedIndex,
    setSelectedIndex,
    groupedResults,
    selectedItem,
    inputRef,
    handleKeyDown,
  } = useCommandPalette({ items, isOpen });

  // preview theme when hovering/navigating to theme items
  useEffect(() => {
    if (!isOpen) return;

    if (selectedItem?.type === "theme" && selectedItem.data) {
      // preview the theme
      const theme = selectedItem.data as OurinTheme;
      setCustomTheme(theme);
    } else if (originalThemeIdRef.current) {
      // revert to original when not on a theme item
      const allThemes = [...builtInThemes, ...customThemes];
      const originalTheme = allThemes.find(
        (t) => t.id === originalThemeIdRef.current
      );
      if (originalTheme) {
        setCustomTheme(originalTheme);
      }
    }
  }, [selectedItem, isOpen, setCustomTheme, builtInThemes, customThemes]);

  // handle close - revert to original theme
  const handleClose = useCallback(() => {
    if (originalThemeIdRef.current) {
      setTheme(originalThemeIdRef.current);
    }
    onClose();
  }, [onClose, setTheme]);

  // handle selection
  const handleSelect = useCallback(
    (item: SearchableItem) => {
      onClose();

      if (item.type === "theme" && item.data) {
        // confirm theme selection - persist to storage
        const theme = item.data as OurinTheme;
        setTheme(theme.id);
      } else if (item.id === "action-settings") {
        onOpenSettings();
      } else if (item.id === "action-toggle-sidebar") {
        onToggleSidebar();
      } else if (item.id === "action-appearance") {
        onOpenAppearance();
      } else if (item.type === "chat" && item.data) {
        onConversationSelect(item.data as string);
      }
    },
    [
      onClose,
      onOpenSettings,
      onToggleSidebar,
      onOpenAppearance,
      onConversationSelect,
      setTheme,
    ]
  );

  // handle enter key
  const handleKeyDownWithEnter = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (selectedItem) {
          // if an item is selected, execute its action
          handleSelect(selectedItem);
        } else if (query.trim()) {
          // if no item selected but there's a query, create new chat with the query
          handleClose();
          onNewChatWithMessage(query.trim());
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      } else {
        handleKeyDown(e);
      }
    },
    [
      selectedItem,
      handleSelect,
      handleClose,
      handleKeyDown,
      query,
      onNewChatWithMessage,
    ]
  );

  // prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // handle starting a new chat (used for the "start a new chat" option)
  const handleStartNewChat = useCallback(() => {
    if (query.trim()) {
      onClose();
      onNewChatWithMessage(query.trim());
    }
  }, [query, onClose, onNewChatWithMessage]);

  if (!isOpen) return null;

  // calculate flat index for each item
  const actionStartIndex = 0;
  const chatStartIndex = groupedResults.actions.length;
  const themeStartIndex = chatStartIndex + groupedResults.chats.length;

  return (
    <div className="z-50 fixed inset-0 flex items-start justify-center pt-[15vh]">
      {/* click outside to close (invisible) */}
      <div className="absolute inset-0" onClick={handleClose} />

      {/* modal */}
      <div
        className="z-10 relative rounded-sm shadow-2xl overflow-hidden animate-scale-in"
        style={{
          width: "720px",
          maxWidth: "calc(100vw - 32px)",
          height: "450px",
          backgroundColor: "var(--color-background-elevated)",
          border: "1px solid var(--color-border-default)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        {/* search input */}
        <div
          className="flex items-center px-4 py-2.5"
          style={{ borderBottom: "1px solid var(--color-border-muted)" }}
        >
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDownWithEnter}
            placeholder="Search or start a new chat..."
            className="flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-base"
            style={{ color: "var(--color-text-primary)" }}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
        </div>

        {/* results */}
        <div
          className="overflow-y-auto py-1 flex-1"
          style={{ height: "395px" }}
        >
          {/* start new chat option - shown when there's a query */}
          {query.trim() && (
            <div className="mb-1">
              <CommandPaletteItem
                icon={Plus}
                label={`Start a new chat "${query.trim().length > 40 ? query.trim().slice(0, 40) + "..." : query.trim()}"`}
                matchedIndices={[]}
                isSelected={selectedIndex === -1}
                onClick={handleStartNewChat}
                onMouseEnter={() => setSelectedIndex(-1)}
              />
            </div>
          )}

          {/* actions section */}
          {groupedResults.actions.length > 0 && (
            <div className="mb-2">
              <div
                className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: "var(--color-text-muted)" }}
              >
                Actions
              </div>
              {groupedResults.actions.map((item, i) => {
                const index = actionStartIndex + i;
                return (
                  <CommandPaletteItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    matchedIndices={item.matchedIndices}
                    shortcut={item.shortcut}
                    isSelected={selectedIndex === index}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  />
                );
              })}
            </div>
          )}

          {/* chats section */}
          {groupedResults.chats.length > 0 && (
            <div className="mb-2">
              <div
                className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: "var(--color-text-muted)" }}
              >
                Chats
              </div>
              {groupedResults.chats.map((item, i) => {
                const index = chatStartIndex + i;
                return (
                  <CommandPaletteItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    matchedIndices={item.matchedIndices}
                    isSelected={selectedIndex === index}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  />
                );
              })}
            </div>
          )}

          {/* themes section */}
          {groupedResults.themes.length > 0 && (
            <div className="mb-2">
              <div
                className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: "var(--color-text-muted)" }}
              >
                Themes
              </div>
              {groupedResults.themes.map((item, i) => {
                const index = themeStartIndex + i;
                const theme = item.data as OurinTheme;
                return (
                  <CommandPaletteItem
                    key={item.id}
                    customIcon={
                      <ThemeColorSwatch
                        backgroundColor={theme.colors.background}
                        textColor={theme.colors.text}
                        accentColor={theme.colors.accent}
                      />
                    }
                    label={item.label}
                    matchedIndices={item.matchedIndices}
                    isSelected={selectedIndex === index}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
