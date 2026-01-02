"use client";

import { useCallback, useMemo } from "react";
import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { FREE_MODEL_ID } from "@/lib/models";
import type { TierInfo } from "@/convex/billing";

/**
 * Hook that provides model access checking based on user tier.
 *
 * Returns functions to check if a model is accessible and get the lock reason.
 */
export function useModelAccess() {
  const { isAuthenticated } = useConvexAuth();
  const tierInfo: TierInfo | undefined = useQuery(
    api.billing.getUserTier,
    isAuthenticated ? {} : "skip"
  );

  const canAccessAllModels = useMemo(() => {
    return tierInfo?.tier === "subscriber" || tierInfo?.tier === "self_hosted";
  }, [tierInfo?.tier]);

  const canAccessModel = useCallback(
    (modelId: string) => {
      // Not authenticated - only free model
      if (!isAuthenticated) {
        return modelId === FREE_MODEL_ID;
      }

      // Loading tier info - be permissive
      if (!tierInfo) {
        return true;
      }

      // Anonymous or free tier - only free model
      if (tierInfo.tier === "anonymous" || tierInfo.tier === "free") {
        return modelId === FREE_MODEL_ID;
      }

      // Subscriber or self-hosted - all models
      if (tierInfo.tier === "subscriber" || tierInfo.tier === "self_hosted") {
        return true;
      }

      return modelId === FREE_MODEL_ID;
    },
    [isAuthenticated, tierInfo]
  );

  const getLockReason = useCallback(() => {
    if (!isAuthenticated) {
      return "Sign in to access this model";
    }
    if (!tierInfo) {
      return "";
    }
    // Self-hosted and subscriber have full access - no lock reason
    if (tierInfo.tier === "self_hosted" || tierInfo.tier === "subscriber") {
      return "";
    }
    if (tierInfo.tier === "anonymous" || tierInfo.tier === "free") {
      return "Subscribe to access this model";
    }
    return "";
  }, [isAuthenticated, tierInfo]);

  return {
    tierInfo,
    isAuthenticated,
    canAccessAllModels,
    canAccessModel,
    getLockReason,
  };
}
