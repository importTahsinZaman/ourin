"use client";

import { useState, useEffect } from "react";

/**
 * Billing config returned from /api/billing/config
 */
interface BillingConfig {
  isSelfHosting: boolean;
  subscriptionCredits: number | null;
  creditPackAmount: number | null;
  creditPackPriceCents: number | null;
}

/**
 * Hook to check if the app is running in production (SaaS) mode vs self-hosting mode.
 *
 * In self-hosting mode (SELF_HOSTING=true or not set):
 * - All users have unrestricted access to all models
 * - No billing/subscription system
 * - Stripe integration disabled
 *
 * In production mode (SELF_HOSTING=false):
 * - Full billing/subscription system active
 * - Tiered access (anonymous, free, own_keys, subscriber)
 * - Credit calculations and limits
 * - Stripe integration enabled
 */
export function useProductionMode() {
  const [isSelfHosting, setIsSelfHosting] = useState<boolean | null>(null);
  const [billingConfig, setBillingConfig] = useState<BillingConfig | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const abortController = new AbortController();

    fetch("/api/billing/config", { signal: abortController.signal })
      .then((res) => res.json())
      .then((data: BillingConfig) => {
        setIsSelfHosting(data.isSelfHosting);
        setBillingConfig(data);
        setIsLoading(false);
      })
      .catch((err) => {
        // Ignore abort errors (component unmounted)
        if (err.name === "AbortError") return;
        // On other errors, assume self-hosting mode (safer default)
        setIsSelfHosting(true);
        setIsLoading(false);
      });

    return () => abortController.abort();
  }, []);

  return {
    /**
     * Whether the app is running in self-hosting mode.
     * null while loading.
     */
    isSelfHosting,

    /**
     * Whether the app is running in production/SaaS mode.
     * Inverse of isSelfHosting. null while loading.
     */
    isProduction: isSelfHosting === null ? null : !isSelfHosting,

    /**
     * Full billing configuration (only available in production mode).
     */
    billingConfig,

    /**
     * Whether the config is still loading.
     */
    isLoading,
  };
}
