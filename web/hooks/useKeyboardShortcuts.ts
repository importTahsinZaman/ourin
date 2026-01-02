"use client";

import { useEffect, useCallback } from "react";
import { KeybindsMap, matchesKeybind } from "@/lib/keybinds";

interface KeyboardShortcutsOptions {
  onToggleSidebar?: () => void;
  onNewChat?: () => void;
  onToggleSettings?: () => void;
  onToggleAppearance?: () => void;
  onCommandPalette?: () => void;
  keybinds: KeybindsMap;
  sidebarSide: "left" | "right";
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  onToggleSidebar,
  onNewChat,
  onToggleSettings,
  onToggleAppearance,
  onCommandPalette,
  keybinds,
  sidebarSide,
  enabled = true,
}: KeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // allow escape and command palette to work even in inputs
        if (e.key !== "Escape" && !matchesKeybind(e, keybinds.commandPalette))
          return;
      }

      // get the correct keybinds based on sidebar position
      const toggleSidebarKeybind =
        sidebarSide === "left"
          ? keybinds.toggleSidebarLeft
          : keybinds.toggleSidebarRight;

      // toggle sidebar
      if (matchesKeybind(e, toggleSidebarKeybind)) {
        e.preventDefault();
        onToggleSidebar?.();
        return;
      }

      // new chat
      if (matchesKeybind(e, keybinds.newChat)) {
        e.preventDefault();
        onNewChat?.();
        return;
      }

      // settings
      if (matchesKeybind(e, keybinds.settings)) {
        e.preventDefault();
        onToggleSettings?.();
        return;
      }

      // appearance
      if (matchesKeybind(e, keybinds.appearance)) {
        e.preventDefault();
        onToggleAppearance?.();
        return;
      }

      // command palette
      if (matchesKeybind(e, keybinds.commandPalette)) {
        e.preventDefault();
        onCommandPalette?.();
        return;
      }
    },
    [
      enabled,
      onToggleSidebar,
      onNewChat,
      onToggleSettings,
      onToggleAppearance,
      onCommandPalette,
      keybinds,
      sidebarSide,
    ]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
