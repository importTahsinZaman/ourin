import { useState, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import {
  getBillingConfig,
  createSubscriptionCheckout,
  createCreditsCheckout,
  createPortalSession,
  type BillingConfig,
} from "@/lib/api";

interface UseBillingReturn {
  // State
  isLoading: boolean;
  billingConfig: BillingConfig | null;
  tier: "anonymous" | "free" | "subscriber" | "self_hosted" | null;

  // Actions
  openSubscribeCheckout: () => Promise<void>;
  openBuyCreditsCheckout: () => Promise<void>;
  openManageSubscription: () => Promise<void>;

  // Derived
  canBuyCredits: boolean;
  isSelfHosting: boolean;
}

export function useBilling(): UseBillingReturn {
  const [billingConfig, setBillingConfig] = useState<BillingConfig | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);

  // Get user tier from Convex
  const tierInfo = useQuery(api.billing.getUserTier);
  const generateChatToken = useMutation(api.chatAuth.generateChatToken);

  // Fetch billing config on mount
  useEffect(() => {
    getBillingConfig()
      .then(setBillingConfig)
      .catch((err) => {
        console.error("Failed to fetch billing config:", err);
      });
  }, []);

  const tier = tierInfo?.tier ?? null;
  const isSelfHosting = billingConfig?.isSelfHosting ?? false;
  const canBuyCredits = tier === "subscriber";

  const openSubscribeCheckout = useCallback(async () => {
    if (isSelfHosting) {
      Alert.alert(
        "Not Available",
        "Billing is not available in self-hosting mode."
      );
      return;
    }

    setIsLoading(true);
    try {
      const tokenResult = await generateChatToken();
      if (!tokenResult.token) {
        throw new Error("Failed to generate auth token");
      }

      const { url } = await createSubscriptionCheckout(tokenResult.token);

      const result = await WebBrowser.openAuthSessionAsync(
        url,
        "ourin://billing"
      );

      if (result.type === "success" && result.url) {
        const urlObj = new URL(result.url);
        if (urlObj.searchParams.get("success")) {
          Alert.alert(
            "Success",
            "Your subscription is being processed. It may take a moment to activate."
          );
        }
      }
    } catch (err) {
      console.error("Checkout error:", err);
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to open checkout"
      );
    } finally {
      setIsLoading(false);
    }
  }, [generateChatToken, isSelfHosting]);

  const openBuyCreditsCheckout = useCallback(async () => {
    if (isSelfHosting) {
      Alert.alert(
        "Not Available",
        "Billing is not available in self-hosting mode."
      );
      return;
    }

    if (!canBuyCredits) {
      Alert.alert(
        "Subscription Required",
        "You need an active subscription to purchase credits."
      );
      return;
    }

    setIsLoading(true);
    try {
      const tokenResult = await generateChatToken();
      if (!tokenResult.token) {
        throw new Error("Failed to generate auth token");
      }

      const { url } = await createCreditsCheckout(tokenResult.token);

      const result = await WebBrowser.openAuthSessionAsync(
        url,
        "ourin://billing"
      );

      if (result.type === "success" && result.url) {
        const urlObj = new URL(result.url);
        if (urlObj.searchParams.get("credits_purchased")) {
          Alert.alert(
            "Success",
            "Your credits have been added to your account."
          );
        }
      }
    } catch (err) {
      console.error("Buy credits error:", err);
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to open checkout"
      );
    } finally {
      setIsLoading(false);
    }
  }, [generateChatToken, isSelfHosting, canBuyCredits]);

  const openManageSubscription = useCallback(async () => {
    if (isSelfHosting) {
      Alert.alert(
        "Not Available",
        "Billing is not available in self-hosting mode."
      );
      return;
    }

    if (tier !== "subscriber") {
      Alert.alert(
        "No Subscription",
        "You don't have an active subscription to manage."
      );
      return;
    }

    setIsLoading(true);
    try {
      const tokenResult = await generateChatToken();
      if (!tokenResult.token) {
        throw new Error("Failed to generate auth token");
      }

      const { url } = await createPortalSession(tokenResult.token);

      await WebBrowser.openAuthSessionAsync(url, "ourin://billing");
    } catch (err) {
      console.error("Portal error:", err);
      Alert.alert(
        "Error",
        err instanceof Error
          ? err.message
          : "Failed to open subscription portal"
      );
    } finally {
      setIsLoading(false);
    }
  }, [generateChatToken, isSelfHosting, tier]);

  return {
    isLoading,
    billingConfig,
    tier,
    openSubscribeCheckout,
    openBuyCreditsCheckout,
    openManageSubscription,
    canBuyCredits,
    isSelfHosting,
  };
}
