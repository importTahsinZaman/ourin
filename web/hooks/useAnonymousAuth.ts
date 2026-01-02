"use client";

import { useCallback, useRef, useEffect } from "react";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { IS_SELF_HOSTING_CLIENT } from "@/lib/config";

/**
 * hook to handle anonymous authentication.
 * provides a function to ensure the user is authenticated,
 * signing them in anonymously if needed.
 *
 * in self-hosting mode, automatically authenticates on mount.
 */
export function useAnonymousAuth() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const isSigningInRef = useRef(false);
  const hasAutoAuthenticatedRef = useRef(false);

  // keep refs updated with latest values for use in async callbacks
  const isAuthenticatedRef = useRef(isAuthenticated);
  const isLoadingRef = useRef(isLoading);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
    isLoadingRef.current = isLoading;
  }, [isAuthenticated, isLoading]);

  // auto-authenticate in self-hosting mode
  useEffect(() => {
    if (
      IS_SELF_HOSTING_CLIENT &&
      !isLoading &&
      !isAuthenticated &&
      !isSigningInRef.current &&
      !hasAutoAuthenticatedRef.current
    ) {
      hasAutoAuthenticatedRef.current = true;
      isSigningInRef.current = true;
      signIn("anonymous")
        .catch((error) => {
          console.error("Auto anonymous sign-in failed:", error);
        })
        .finally(() => {
          isSigningInRef.current = false;
        });
    }
  }, [isLoading, isAuthenticated, signIn]);

  /**
   * ensures the user has an authenticated session.
   * if not authenticated, signs them in anonymously.
   * returns a promise that resolves to true when authentication is complete.
   */
  const ensureAuthenticated = useCallback(async (): Promise<boolean> => {
    // already authenticated
    if (isAuthenticatedRef.current) {
      return true;
    }

    // wait for loading to complete
    if (isLoadingRef.current) {
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (!isLoadingRef.current) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 50);
      });
      // re-check after loading completes
      if (isAuthenticatedRef.current) {
        return true;
      }
    }

    // prevent concurrent sign-in attempts
    if (isSigningInRef.current) {
      // wait for the in-progress sign-in to complete (with timeout)
      const waitResult = await new Promise<boolean>((resolve) => {
        const maxWaitMs = 10000;
        const startTime = Date.now();
        const checkInterval = setInterval(() => {
          if (!isSigningInRef.current && isAuthenticatedRef.current) {
            clearInterval(checkInterval);
            resolve(true);
          } else if (!isSigningInRef.current) {
            // sign-in finished but not authenticated (failed)
            clearInterval(checkInterval);
            resolve(false);
          } else if (Date.now() - startTime > maxWaitMs) {
            clearInterval(checkInterval);
            resolve(false);
          }
        }, 50);
      });
      return waitResult;
    }

    // not authenticated - sign in anonymously
    try {
      isSigningInRef.current = true;
      await signIn("anonymous");

      // wait for auth state to propagate (signIn resolves before state updates)
      await new Promise<void>((resolve, reject) => {
        const maxWaitMs = 5000;
        const startTime = Date.now();
        const checkInterval = setInterval(() => {
          if (isAuthenticatedRef.current) {
            clearInterval(checkInterval);
            resolve();
          } else if (Date.now() - startTime > maxWaitMs) {
            clearInterval(checkInterval);
            reject(new Error("Timeout waiting for auth state"));
          }
        }, 50);
      });

      return true;
    } catch (error) {
      console.error("Anonymous sign-in failed:", error);
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
