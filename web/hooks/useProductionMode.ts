"use client";

import { useState, useEffect } from "react";

/**
 * billing config returned from /api/billing/config
 */
interface BillingConfig {
  isSelfHosting: boolean;
  subscriptionCredits: number | null;
  creditPackAmount: number | null;
  creditPackPriceCents: number | null;
}

/**
 * hook to check if the app is running in production (saaS) mode vs self-hosting mode.
 *
 * in self-hosting mode (sELF_hOSTING=true or not set):
 * - all users have unrestricted access to all models
 * - no billing/subscription system
 * - stripe integration disabled
 *
 * in production mode (sELF_hOSTING=false):
 * - full billing/subscription system active
 * - tiered access (anonymous, free, subscriber)
 * - credit calculations and limits
 * - stripe integration enabled
 * - bYOK (bring your own key) available for subscribers
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
        // ignore abort errors (component unmounted)
        if (err.name === "AbortError") return;
        // on other errors, assume self-hosting mode (safer default)
        setIsSelfHosting(true);
        setIsLoading(false);
      });

    return () => abortController.abort();
  }, []);

  return {
    /**
     * whether the app is running in self-hosting mode.
     * null while loading.
     */
    isSelfHosting,

    /**
     * whether the app is running in production/saaS mode.
     * inverse of isSelfHosting. null while loading.
     */
    isProduction: isSelfHosting === null ? null : !isSelfHosting,

    /**
     * full billing configuration (only available in production mode).
     */
    billingConfig,

    /**
     * whether the config is still loading.
     */
    isLoading,
  };
}
