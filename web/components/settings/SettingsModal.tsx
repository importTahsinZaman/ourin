"use client";

import { useState, useEffect, useRef, ReactNode, useMemo } from "react";
import { X, CreditCard, Key, Keyboard, LogOut, Loader2 } from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ApiKeysTab } from "./tabs/ApiKeysTab";
import { AccountTab, SignUpStep, AuthFlow } from "./tabs/AccountTab";
import { KeybindsTab } from "./tabs/KeybindsTab";
import { IS_SELF_HOSTING_CLIENT } from "@/lib/config";
import { toast } from "sonner";
import { useAnalytics } from "@/hooks/useAnalytics";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = "api-keys" | "subscription" | "keybinds";

const allTabs: { id: Tab; label: string; icon: typeof CreditCard }[] = [
  { id: "subscription", label: "Account", icon: CreditCard },
  { id: "api-keys", label: "API Keys", icon: Key },
  { id: "keybinds", label: "Keybinds", icon: Keyboard },
];

// Reusable section component for consistent layout
interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function SettingsSection({
  title,
  description,
  children,
}: SettingsSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h4
          className="font-medium text-sm"
          style={{ color: "var(--color-text-primary)" }}
        >
          {title}
        </h4>
        {description && (
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

// Horizontal divider between sections
export function SettingsDivider() {
  return (
    <div
      className="my-6 h-px"
      style={{ backgroundColor: "var(--color-border-muted)" }}
    />
  );
}

// Pricing features for the left side panel (sign-up / subscribe)
const SUBSCRIPTION_FEATURES = [
  {
    title: "Premium Models",
    description: "The best GPT, Claude, and Gemini models in one place",
  },
  {
    title: "Generous Monthly Limit",
    description: "Generous monthly credit allowance, buy more anytime",
  },
  {
    title: "Premium Features",
    description: "Web search, image uploads, theme and font customization",
  },
  {
    title: "BYOK Support",
    description: "Use your own API keys to bypass credit usage",
  },
];

// Format price from cents to display string (e.g., 1000 -> "$10")
function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return dollars % 1 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

// Left side pricing panel component
function PricingPanel({
  variant,
  priceCents,
}: {
  variant: "signUp" | "signIn" | "subscribe";
  priceCents: number;
}) {
  const isSignIn = variant === "signIn";

  return (
    <div
      className="relative flex flex-col flex-1 justify-between p-10 overflow-hidden"
      style={{
        backgroundColor: "var(--color-background-secondary)",
        borderRight: "1px solid var(--color-border-muted)",
      }}
    >
      {/* Decorative gradient orbs */}
      <div
        className="-top-32 -left-32 absolute opacity-30 blur-3xl rounded-full w-64 h-64"
        style={{ backgroundColor: "var(--color-accent-primary)" }}
      />
      <div
        className="-right-32 -bottom-32 absolute opacity-20 blur-3xl rounded-full w-96 h-96"
        style={{ backgroundColor: "var(--color-accent-primary)" }}
      />

      {/* Header */}
      <div className="z-10 relative">
        <h1
          className="mb-3 font-bold text-4xl tracking-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          Ourin
        </h1>
        <p className="text-lg" style={{ color: "var(--color-text-secondary)" }}>
          Your AI assistant, your way
        </p>
      </div>

      {/* Features list */}
      <div className="z-10 relative space-y-4">
        {SUBSCRIPTION_FEATURES.map((feature) => (
          <div key={feature.title}>
            <h3
              className="font-medium text-sm"
              style={{ color: "var(--color-text-primary)" }}
            >
              {feature.title}
            </h3>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {feature.description}
            </p>
          </div>
        ))}
      </div>

      {/* Footer - pricing */}
      <div className="z-10 relative">
        {!isSignIn && (
          <div className="mb-2">
            <span
              className="font-bold text-3xl"
              style={{ color: "var(--color-accent-primary)" }}
            >
              {formatPrice(priceCents)}
            </span>
            <span
              className="text-base"
              style={{ color: "var(--color-text-muted)" }}
            >
              /month
            </span>
          </div>
        )}
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {isSignIn
            ? "Continue right where you left off"
            : "Cancel anytime. No hidden fees."}
        </p>
      </div>
    </div>
  );
}

// Subscribe panel for signed-in non-subscribers
function SubscribePanel({
  onClose,
  priceCents,
}: {
  onClose: () => void;
  priceCents: number;
}) {
  const { signOut } = useAuthActions();
  const analytics = useAnalytics();
  const generateChatToken = useMutation(api.chatAuth.generateChatToken);
  const tierInfo = useQuery(api.billing.getUserTier);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribe = async () => {
    setIsLoading(true);
    analytics.trackSubscriptionEvent({
      tier: tierInfo?.tier ?? "free",
      action: "checkout_started",
    });
    try {
      const tokenResult = await generateChatToken();
      if (!tokenResult) {
        toast.error("Please sign in to subscribe");
        setIsLoading(false);
        return;
      }
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenResult.token}`,
        },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error("Failed to create checkout session");
      const { url } = await response.json();
      if (url) window.location.href = url;
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Failed to start checkout", {
        description: "Please try again.",
      });
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    onClose();
  };

  return (
    <div className="relative flex flex-col flex-1">
      {/* Close button */}
      <button
        onClick={onClose}
        className="top-4 right-4 z-10 absolute hover:bg-[var(--color-background-hover)] p-1.5 rounded-sm transition-colors"
        style={{ color: "var(--color-text-muted)" }}
      >
        <X className="w-5 h-5" />
      </button>

      {/* Centered content */}
      <div className="flex flex-col flex-1 justify-center items-center px-12 py-8">
        <div className="space-y-8 w-full max-w-sm text-center">
          <div>
            <h2
              className="mb-2 font-semibold text-2xl"
              style={{ color: "var(--color-text-primary)" }}
            >
              Ready to upgrade?
            </h2>
            <p
              className="text-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Get access to all premium models and features
            </p>
          </div>

          <button
            onClick={handleSubscribe}
            disabled={isLoading}
            className="flex justify-center items-center gap-2 disabled:opacity-50 py-3 rounded-sm w-full font-medium text-sm transition-colors"
            style={{
              backgroundColor: "var(--color-accent-primary)",
              color: "var(--color-text-inverse)",
            }}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                Subscribe - {formatPrice(priceCents)}/month
              </>
            )}
          </button>

          <button
            onClick={handleLogout}
            className="flex justify-center items-center gap-2 py-2.5 rounded-sm w-full font-medium text-sm transition-colors"
            style={{
              backgroundColor: "transparent",
              color: "var(--color-text-muted)",
              border: "1px solid var(--color-border-default)",
            }}
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  // Filter out API Keys tab in self-hosting mode
  const tabs = useMemo(
    () =>
      IS_SELF_HOSTING_CLIENT
        ? allTabs.filter((t) => t.id !== "api-keys")
        : allTabs,
    []
  );

  const [activeTab, setActiveTab] = useState<Tab>("subscription");
  const { signOut } = useAuthActions();

  // Auth form state - lifted here to survive AccountTab remounts during auth state changes
  const [signUpStep, setSignUpStep] = useState<SignUpStep>("profile");
  // Default to signUp flow for new users
  const [authFlow, setAuthFlow] = useState<AuthFlow>("signUp");

  // Check if user is anonymous
  const { isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(
    api.settings.getCurrentUser,
    isAuthenticated ? {} : "skip"
  );
  const tierInfo = useQuery(
    api.billing.getUserTier,
    IS_SELF_HOSTING_CLIENT ? "skip" : {}
  );

  const isAnonymousUser = !isAuthenticated || currentUser?.isAnonymous;
  const isFullyAuthenticated =
    isAuthenticated && currentUser?.emailVerified && !currentUser?.isAnonymous;
  const isSubscriber = IS_SELF_HOSTING_CLIENT
    ? true
    : tierInfo?.tier === "subscriber";
  const isSignedInNonSubscriber =
    !IS_SELF_HOSTING_CLIENT && isFullyAuthenticated && !isSubscriber;

  // Track previous state to detect successful sign-in/sign-up
  const wasNotFullyAuthRef = useRef(!isFullyAuthenticated);
  const isMountedRef = useRef(true);
  const generateChatToken = useMutation(api.chatAuth.generateChatToken);
  const analytics = useAnalytics();
  const [isRedirectingToStripe, setIsRedirectingToStripe] = useState(false);

  // Subscription price from billing config (fallback to $10 = 1000 cents)
  const [subscriptionPriceCents, setSubscriptionPriceCents] = useState(1000);

  // Fetch billing config to get dynamic subscription price
  useEffect(() => {
    if (!isOpen || IS_SELF_HOSTING_CLIENT) return;

    const fetchBillingConfig = async () => {
      try {
        const response = await fetch("/api/billing/config");
        if (!response.ok) return;
        const config = await response.json();
        if (config.subscriptionPriceCents && isMountedRef.current) {
          setSubscriptionPriceCents(config.subscriptionPriceCents);
        }
      } catch {
        // Silently fail - use fallback price
      }
    };
    fetchBillingConfig();
  }, [isOpen]);

  // Track mounted state to prevent state updates after unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Handle auth state changes - close for sign-in, redirect to Stripe for sign-up
  useEffect(() => {
    // User just became fully authenticated
    if (wasNotFullyAuthRef.current && isFullyAuthenticated && isOpen) {
      if (authFlow === "signIn") {
        // Sign-in: just close the modal
        onClose();
      } else {
        // Sign-up: redirect to Stripe checkout
        setIsRedirectingToStripe(true);
        const redirectToStripe = async () => {
          try {
            analytics.trackSubscriptionEvent({
              tier: "free",
              action: "checkout_started",
            });
            const tokenResult = await generateChatToken();
            if (!isMountedRef.current) return;
            if (!tokenResult) {
              toast.error("Failed to authenticate. Please try again.");
              setIsRedirectingToStripe(false);
              return;
            }
            const response = await fetch("/api/stripe/checkout", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${tokenResult.token}`,
              },
              body: JSON.stringify({}),
            });
            if (!isMountedRef.current) return;
            if (!response.ok)
              throw new Error("Failed to create checkout session");
            const { url } = await response.json();
            if (url) window.location.href = url;
          } catch (error) {
            console.error("Stripe redirect error:", error);
            if (!isMountedRef.current) return;
            toast.error("Failed to redirect to checkout", {
              description: "Please click Subscribe to try again.",
            });
            setIsRedirectingToStripe(false);
          }
        };
        redirectToStripe();
      }
    }
    wasNotFullyAuthRef.current = !isFullyAuthenticated;
  }, [
    isFullyAuthenticated,
    isOpen,
    onClose,
    authFlow,
    generateChatToken,
    analytics,
  ]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Modal variant 1: Anonymous users need to sign up (or sign in)
  // Also show this while redirecting to Stripe to avoid flash of subscribe modal
  const needsAuth = !isFullyAuthenticated || isRedirectingToStripe;

  if (needsAuth) {
    return (
      <div className="z-50 fixed inset-0 flex justify-center items-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={isRedirectingToStripe ? undefined : onClose}
        />

        {/* Modal - same size as full settings modal */}
        <div
          className="z-10 relative flex shadow-2xl mx-4 rounded-sm w-full max-w-[1000px] h-[780px] overflow-hidden animate-scale-in"
          style={{
            backgroundColor: "var(--color-background-elevated)",
            border: "1px solid var(--color-border-default)",
          }}
        >
          {/* Left side - Pricing/Welcome panel */}
          <PricingPanel
            variant={authFlow === "signIn" ? "signIn" : "signUp"}
            priceCents={subscriptionPriceCents}
          />

          {/* Right side - Auth form or redirecting state */}
          <div className="relative flex flex-col flex-1">
            {/* Close button - hide while redirecting */}
            {!isRedirectingToStripe && (
              <button
                onClick={onClose}
                className="top-4 right-4 z-10 absolute hover:bg-[var(--color-background-hover)] p-1.5 rounded-sm transition-colors"
                style={{ color: "var(--color-text-muted)" }}
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {/* Centered form or redirecting state */}
            <div className="flex flex-1 justify-center items-center px-12 py-8">
              <div className="w-full max-w-sm">
                {isRedirectingToStripe ? (
                  <div className="space-y-4 text-center">
                    <p
                      className="font-medium"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      Redirecting to checkout...
                    </p>
                  </div>
                ) : (
                  <AccountTab
                    signUpStep={signUpStep}
                    setSignUpStep={setSignUpStep}
                    flow={authFlow}
                    setFlow={setAuthFlow}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Modal variant 2: Signed-in but not subscribed - show subscribe modal
  if (isSignedInNonSubscriber) {
    return (
      <div className="z-50 fixed inset-0 flex justify-center items-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <div
          className="z-10 relative flex shadow-2xl mx-4 rounded-sm w-full max-w-[1000px] h-[780px] overflow-hidden animate-scale-in"
          style={{
            backgroundColor: "var(--color-background-elevated)",
            border: "1px solid var(--color-border-default)",
          }}
        >
          {/* Left side - Pricing panel */}
          <PricingPanel
            variant="subscribe"
            priceCents={subscriptionPriceCents}
          />

          {/* Right side - Subscribe button + logout */}
          <SubscribePanel
            onClose={onClose}
            priceCents={subscriptionPriceCents}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="z-50 fixed inset-0 flex justify-center items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal - 30% larger */}
      <div
        className="z-10 relative flex shadow-2xl mx-4 rounded-sm w-full max-w-[1000px] h-[780px] overflow-hidden animate-scale-in"
        style={{
          backgroundColor: "var(--color-background-elevated)",
          border: "1px solid var(--color-border-default)",
        }}
      >
        {/* Sidebar - wider with more generous padding */}
        <div
          className="flex flex-col flex-shrink-0 px-4 py-5 w-56"
          style={{
            backgroundColor: "var(--color-background-secondary)",
            borderRight: "1px solid var(--color-border-muted)",
          }}
        >
          <div className="flex-1">
            <h2
              className="mb-6 font-semibold text-base tracking-tight"
              style={{ color: "var(--color-text-primary)" }}
            >
              Settings
            </h2>

            <nav className="space-y-0.5">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-3 px-2 py-2 rounded-sm w-full text-sm transition-colors ${
                      isActive
                        ? "bg-[var(--color-background-active)]"
                        : "hover:bg-[var(--color-background-hover)]"
                    }`}
                    style={{
                      color: "var(--color-text-primary)",
                    }}
                  >
                    <Icon
                      className="w-4 h-4"
                      style={{ color: "var(--color-text-muted)" }}
                    />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* User info at bottom */}
          <div
            className="-mx-4 px-4 pt-4 border-t"
            style={{ borderColor: "var(--color-border-muted)" }}
          >
            {currentUser === undefined ? (
              <div className="flex justify-center py-2">
                <Loader2
                  className="w-4 h-4 animate-spin"
                  style={{ color: "var(--color-text-muted)" }}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <p
                  className="flex-1 text-sm truncate"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {currentUser?.email?.split("@")[0]}
                </p>
                <button
                  onClick={() => signOut()}
                  className="hover:bg-red-500/10 p-1.5 rounded-sm transition-colors shrink-0"
                  style={{ color: "var(--color-text-muted)" }}
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div
          className="relative flex flex-col flex-1"
          style={{ backgroundColor: "var(--color-background-elevated)" }}
        >
          {/* Close button - absolute positioned in corner */}
          <button
            onClick={onClose}
            className="top-4 right-4 z-10 absolute hover:bg-[var(--color-background-hover)] p-1.5 rounded-sm transition-colors"
            style={{ color: "var(--color-text-muted)" }}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Tab content - more generous padding */}
          <div className="flex-1 px-8 py-6 overflow-y-auto">
            {activeTab === "subscription" && (
              <AccountTab
                signUpStep={signUpStep}
                setSignUpStep={setSignUpStep}
                flow={authFlow}
                setFlow={setAuthFlow}
              />
            )}
            {activeTab === "api-keys" && <ApiKeysTab />}
            {activeTab === "keybinds" && <KeybindsTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
