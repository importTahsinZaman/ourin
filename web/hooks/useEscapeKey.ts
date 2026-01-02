"use client";

import { useEffect } from "react";

/**
 * Hook that listens for the Escape key and calls the handler.
 *
 * @param handler - Callback to run when Escape is pressed
 * @param enabled - Whether the hook is active (default: true)
 */
export function useEscapeKey(handler: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handler();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handler, enabled]);
}
