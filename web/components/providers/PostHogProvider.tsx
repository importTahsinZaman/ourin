"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect, ReactNode } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

// postHog is enabled if and only if the aPI key is configured
const isPostHogEnabled = !!POSTHOG_KEY;

// initialize postHog once on client
if (typeof window !== "undefined" && isPostHogEnabled && POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false, // handled manually for sPA routing
    capture_pageleave: true,
    persistence: "localStorage+cookie",
    autocapture: false, // manual tracking for precision
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "[data-ph-mask]",
    },
  });
}

interface PostHogProviderProps {
  children: ReactNode;
}

export function PostHogProvider({ children }: PostHogProviderProps) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const currentUser = useQuery(
    api.settings.getCurrentUser,
    isAuthenticated ? {} : "skip"
  );
  const userTier = useQuery(
    api.billing.getUserTier,
    isAuthenticated ? {} : "skip"
  );

  // identify user when authenticated
  useEffect(() => {
    if (!isPostHogEnabled || isLoading) return;

    if (isAuthenticated && currentUser) {
      posthog.identify(currentUser._id, {
        email: currentUser.email,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        isAnonymous: currentUser.isAnonymous,
        tier: userTier?.tier,
      });
    } else if (!isAuthenticated && !isLoading) {
      posthog.reset();
    }
  }, [isAuthenticated, isLoading, currentUser, userTier]);

  // skip provider if postHog is not configured
  if (!isPostHogEnabled) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>{children as React.ReactNode}</PHProvider>
  );
}

export { isPostHogEnabled };
