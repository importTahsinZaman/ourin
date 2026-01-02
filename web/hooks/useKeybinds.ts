"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  KeybindsMap,
  DEFAULT_KEYBINDS,
  parseKeybinds,
  KEYBINDS_STORAGE_KEY,
} from "@/lib/keybinds";

/**
 * hook to get the current keybinds configuration.
 * - for authenticated users: fetches from convex dB
 * - for anonymous users: reads from localStorage
 * - returns dEFAULT_kEYBINDS while loading
 */
export function useKeybinds(): KeybindsMap {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();

  // dB query for authenticated users
  const savedKeybinds = useQuery(
    api.settings.getKeybinds,
    isAuthenticated ? {} : "skip"
  );

  // local state for the resolved keybinds
  const [keybinds, setKeybinds] = useState<KeybindsMap>({
    ...DEFAULT_KEYBINDS,
  });

  useEffect(() => {
    // still loading auth state
    if (isAuthLoading) return;

    if (isAuthenticated) {
      // authenticated: use dB (or defaults while loading)
      if (savedKeybinds !== undefined) {
        setKeybinds(parseKeybinds(savedKeybinds));
      }
    } else {
      // anonymous: use localStorage
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(KEYBINDS_STORAGE_KEY);
        setKeybinds(parseKeybinds(stored));
      }
    }
  }, [isAuthenticated, isAuthLoading, savedKeybinds]);

  // also listen for storage changes (for anonymous users in other tabs)
  useEffect(() => {
    if (isAuthenticated) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === KEYBINDS_STORAGE_KEY) {
        setKeybinds(parseKeybinds(e.newValue));
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [isAuthenticated]);

  return keybinds;
}
