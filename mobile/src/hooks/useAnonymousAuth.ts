import { useEffect, useRef, useCallback } from "react";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";

/**
 * Hook for anonymous authentication.
 *
 * Provides:
 * - Auto sign-in on first launch
 * - ensureAuthenticated() for signing in before API calls
 *
 * Usage:
 * ```tsx
 * function ChatScreen() {
 *   const { ensureAuthenticated, isAuthenticated, isLoading } = useAnonymousAuth();
 *
 *   const sendMessage = async () => {
 *     const success = await ensureAuthenticated();
 *     if (!success) return;
 *     // ... send message
 *   };
 * }
 * ```
 */
export function useAnonymousAuth() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();

  // Refs to track current state and prevent race conditions
  const isAuthenticatedRef = useRef(isAuthenticated);
  const isLoadingRef = useRef(isLoading);
  const isSigningInRef = useRef(false);

  // Keep refs in sync
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
    isLoadingRef.current = isLoading;
  }, [isAuthenticated, isLoading]);

  // Auto sign-in on app launch if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isSigningInRef.current) {
      isSigningInRef.current = true;
      signIn("anonymous")
        .catch((error) => {
          console.error("[Auth] Auto anonymous sign-in failed:", error);
        })
        .finally(() => {
          isSigningInRef.current = false;
        });
    }
  }, [isLoading, isAuthenticated, signIn]);

  /**
   * Ensure the user is authenticated before making API calls.
   * Signs in anonymously if not authenticated.
   *
   * @returns true if authenticated, false if sign-in failed
   */
  const ensureAuthenticated = useCallback(async (): Promise<boolean> => {
    // Already authenticated
    if (isAuthenticatedRef.current) {
      return true;
    }

    // Wait for loading to complete
    if (isLoadingRef.current) {
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (!isLoadingRef.current) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 50);

        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 10000);
      });

      // Check again after loading
      if (isAuthenticatedRef.current) {
        return true;
      }
    }

    // Already signing in - wait for it
    if (isSigningInRef.current) {
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (!isSigningInRef.current) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 50);

        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 10000);
      });

      return isAuthenticatedRef.current;
    }

    // Sign in anonymously
    try {
      isSigningInRef.current = true;
      await signIn("anonymous");

      // Wait for auth state to propagate
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (isAuthenticatedRef.current) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 50);

        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 5000);
      });

      return isAuthenticatedRef.current;
    } catch (error) {
      console.error("[Auth] Anonymous sign-in failed:", error);
      return false;
    } finally {
      isSigningInRef.current = false;
    }
  }, [signIn]);

  return {
    ensureAuthenticated,
    isAuthenticated,
    isLoading,
  };
}
