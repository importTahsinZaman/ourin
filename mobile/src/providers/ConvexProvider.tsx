import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ReactNode, useCallback } from "react";
import { router } from "expo-router";
import { secureTokenStorage } from "@/lib/secureStorage";

// Validate convex url
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error(
    "EXPO_PUBLIC_CONVEX_URL is required. Check your .env.local file."
  );
}

// Convex client instance
const convex = new ConvexReactClient(convexUrl);

interface ConvexProviderProps {
  children: ReactNode;
}

/**
 * Handle URL replacement for OAuth callback (removes code param from URL).
 * Uses expo-router's imperative API since this runs outside of navigation context.
 */
function handleReplaceURL(url: string) {
  try {
    // Use expo-router's imperative navigation
    router.replace(url as never);
  } catch (error) {
    // Ignore navigation errors during initial render or when router is not ready
    console.warn("[ConvexProvider] Failed to replace URL:", error);
  }
}

/**
 * Convex Auth Provider configured for React Native.
 *
 * Uses expo-secure-store for secure token storage instead of cookies/localStorage.
 * Handles URL replacement for OAuth flows with Expo Router.
 */
export function ConvexProvider({ children }: ConvexProviderProps) {
  return (
    <ConvexAuthProvider
      client={convex}
      storage={secureTokenStorage}
      replaceURL={handleReplaceURL}
    >
      {children}
    </ConvexAuthProvider>
  );
}

// Re-export convex client for direct access if needed
export { convex };
