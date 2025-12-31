"use client";

import { useState, useEffect, useRef, ReactNode, useMemo } from "react";
import { X, CreditCard, Key, Keyboard, LogOut, Loader2 } from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ApiKeysTab } from "./tabs/ApiKeysTab";
import { AccountTab, SignUpStep, AuthFlow } from "./tabs/AccountTab";
import { KeybindsTab } from "./tabs/KeybindsTab";
import { IS_SELF_HOSTING_CLIENT } from "@/lib/config";

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
  const [authFlow, setAuthFlow] = useState<AuthFlow>("signIn");

  // Check if user is anonymous
  const { isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(
    api.settings.getCurrentUser,
    isAuthenticated ? {} : "skip"
  );
  const isAnonymousUser = !isAuthenticated || currentUser?.isAnonymous;
  const isFullyAuthenticated =
    isAuthenticated && currentUser?.emailVerified && !currentUser?.isAnonymous;

  // Track previous state to detect successful sign-in/sign-up
  const wasNotFullyAuthRef = useRef(!isFullyAuthenticated);

  // Close modal when user successfully signs in/up (transitions to fully authenticated with verified email)
  useEffect(() => {
    if (wasNotFullyAuthRef.current && isFullyAuthenticated && isOpen) {
      onClose();
    }
    wasNotFullyAuthRef.current = !isFullyAuthenticated;
  }, [isFullyAuthenticated, isOpen, onClose]);

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

  // Simplified modal for users who need to authenticate (anonymous OR unverified email)
  // Keep showing this layout throughout the entire signup flow to prevent remounting
  const needsAuth = !isFullyAuthenticated;

  if (needsAuth) {
    return (
      <div className="z-50 fixed inset-0 flex justify-center items-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal - same size as full settings modal */}
        <div
          className="z-10 relative flex shadow-2xl mx-4 rounded-sm w-full max-w-[1000px] h-[780px] overflow-hidden animate-scale-in"
          style={{
            backgroundColor: "var(--color-background-elevated)",
            border: "1px solid var(--color-border-default)",
          }}
        >
          {/* Left side - Branding */}
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

            {/* Logo and tagline */}
            <div className="z-10 relative">
              <h1
                className="mb-3 font-bold text-4xl tracking-tight"
                style={{ color: "var(--color-text-primary)" }}
              >
                Ourin
              </h1>
              <p
                className="text-lg"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Your AI assistant, your way.
              </p>
            </div>

            {/* Features list */}
            <div className="z-10 relative space-y-6">
              {[
                {
                  title: "All the best models",
                  description: "GPT, Claude, and Gemini models in one place",
                },
                {
                  title: "Secure and Open Source",
                  description:
                    "Fully auditable source code, no need to trust a black box",
                },
                {
                  title: "Personalized experience",
                  description:
                    "Custom themes, dynamic system prompting, and keybinds",
                },
              ].map((feature) => (
                <div key={feature.title} className="flex items-start gap-3">
                  <div
                    className="mt-[6px] rounded-full w-2 h-2 shrink-0"
                    style={{ backgroundColor: "var(--color-accent-primary)" }}
                  />
                  <div>
                    <h3
                      className="font-medium text-sm"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {feature.title}
                    </h3>
                    <p
                      className="text-sm"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <p
              className="z-10 relative text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              Free to start · No credit card required
            </p>
          </div>

          {/* Right side - Auth form */}
          <div className="relative flex flex-col flex-1">
            {/* Close button */}
            <button
              onClick={onClose}
              className="top-4 right-4 z-10 absolute hover:bg-[var(--color-background-hover)] p-1.5 rounded-sm transition-colors"
              style={{ color: "var(--color-text-muted)" }}
            >
              <X className="w-5 h-5" />
            </button>

            {/* Centered form */}
            <div className="flex flex-1 justify-center items-center px-12 py-8">
              <div className="w-full max-w-sm">
                <AccountTab
                  signUpStep={signUpStep}
                  setSignUpStep={setSignUpStep}
                  flow={authFlow}
                  setFlow={setAuthFlow}
                />
              </div>
            </div>
          </div>
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
