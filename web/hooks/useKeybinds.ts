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
 * Hook to get the current keybinds configuration.
 * - For authenticated users: fetches from Convex DB
 * - For anonymous users: reads from localStorage
 * - Returns DEFAULT_KEYBINDS while loading
 */
export function useKeybinds(): KeybindsMap {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();

  // DB query for authenticated users
  const savedKeybinds = useQuery(
    api.settings.getKeybinds,
    isAuthenticated ? {} : "skip"
  );

  // Local state for the resolved keybinds
  const [keybinds, setKeybinds] = useState<KeybindsMap>({
    ...DEFAULT_KEYBINDS,
  });

  useEffect(() => {
    // Still loading auth state
    if (isAuthLoading) return;

    if (isAuthenticated) {
      // Authenticated: use DB (or defaults while loading)
      if (savedKeybinds !== undefined) {
        setKeybinds(parseKeybinds(savedKeybinds));
      }
    } else {
      // Anonymous: use localStorage
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(KEYBINDS_STORAGE_KEY);
        setKeybinds(parseKeybinds(stored));
      }
    }
  }, [isAuthenticated, isAuthLoading, savedKeybinds]);

  // Also listen for storage changes (for anonymous users in other tabs)
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
