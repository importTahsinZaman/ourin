"use client";

import { useState, useEffect, useRef } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Loader2,
  Eye,
  EyeOff,
  ArrowLeft,
  CreditCard,
  Zap,
  ExternalLink,
  Key,
  Coins,
  ChevronDown,
  Sparkles,
  Infinity as InfinityIcon,
} from "lucide-react";
import { toast } from "sonner";
import { SettingsSection, SettingsDivider } from "../SettingsModal";
import { useProductionMode } from "@/hooks/useProductionMode";
import { IS_SELF_HOSTING_CLIENT } from "@/lib/config";

// Billing config type
interface BillingConfig {
  isSelfHosting?: boolean;
  subscriptionCredits: number | null;
  creditPackAmount: number | null;
  creditPackPriceCents: number | null;
}

// Default config (fallback)
const DEFAULT_CONFIG: BillingConfig = {
  isSelfHosting: true,
  subscriptionCredits: 10000,
  creditPackAmount: 20000,
  creditPackPriceCents: 2000,
};

// Free tier limits
const FREE_TIER_MESSAGE_LIMIT = 10;
const FREE_TIER_WARNING_THRESHOLD = 8;

// Password validation helper
function validatePassword(password: string, confirmPassword: string) {
  return {
    minLength: password.length >= 8,
    hasLowercase: /[a-z]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSymbol: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
    passwordsMatch: password === confirmPassword && password.length > 0,
  };
}

export type SignUpStep = "profile" | "password" | "verification";

export type AuthFlow = "signIn" | "signUp";

interface AuthFormProps {
  signUpStep: SignUpStep;
  setSignUpStep: (step: SignUpStep) => void;
  flow: AuthFlow;
  setFlow: (flow: AuthFlow) => void;
}

function AuthForm({ signUpStep, setSignUpStep, flow, setFlow }: AuthFormProps) {
  const { signIn } = useAuthActions();

  // Get current user to pass for account linking (anonymous -> real account)
  const { isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(
    api.settings.getCurrentUser,
    isAuthenticated ? {} : "skip"
  );
  const registerPendingLink = useMutation(
    api.settings.registerPendingAccountLink
  );

  // Form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password validation
  const passwordValidation = validatePassword(password, confirmPassword);
  const isPasswordValid = Object.values(passwordValidation).every(Boolean);

  // Handle sign-in submission
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.set("email", email);
    formData.set("password", password);
    formData.set("flow", "signIn");

    try {
      const result = await signIn("password", formData);

      if (result && typeof result === "object" && "signingIn" in result) {
        if (result.signingIn === false) {
          setError("Invalid email or password");
          setLoading(false);
        } else {
          // Success
          toast.success("Welcome back!");
        }
      }
    } catch {
      setError("Invalid email or password");
      setLoading(false);
    }
  };

  // Handle sign-up step 1 -> step 2
  const handleProfileContinue = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSignUpStep("password");
  };

  // Handle sign-up step 2 -> submit & go to verification
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) {
      setError("Please ensure your password meets all requirements");
      return;
    }

    setLoading(true);
    setError(null);

    // Register pending account link BEFORE calling signIn
    // This stores the anonymous userId -> email mapping in the database
    if (currentUser?.isAnonymous) {
      try {
        await registerPendingLink({ email: email.toLowerCase().trim() });
      } catch (err) {
        console.error("Failed to register pending link:", err);
        // Continue anyway - worst case is conversations don't transfer
      }
    }

    const formData = new FormData();
    formData.set("email", email);
    formData.set("password", password);
    formData.set("flow", "signUp");
    formData.set("firstName", firstName);
    formData.set("lastName", lastName);

    try {
      await signIn("password", formData);
      setSignUpStep("verification");
      setLoading(false);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  // Handle verification code submission
  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.set("email", email);
    formData.set("code", verificationCode);
    formData.set("flow", "email-verification");
    // Pass profile data - user is created during verification step
    formData.set("firstName", firstName);
    formData.set("lastName", lastName);

    try {
      const result = await signIn("password", formData);

      if (result && "signingIn" in result && !result.signingIn) {
        setVerificationCode("");
        setError("That code didn't work. Please check and try again.");
        setLoading(false);
      } else {
        // Success: auth state changes, modal closes automatically
        toast.success("Account created successfully!");
        setLoading(false);
      }
    } catch (err) {
      // Convex auth throws an error when verification code is wrong
      const errorMessage = err instanceof Error ? err.message : "";
      if (
        errorMessage.includes("verify code") ||
        errorMessage.includes("verification")
      ) {
        setVerificationCode("");
        setError("That code didn't work. Please check and try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
      setLoading(false);
    }
  };

  // Resend verification code
  const handleResendCode = async () => {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.set("email", email);
    formData.set("password", password);
    formData.set("flow", "signUp");
    formData.set("firstName", firstName);
    formData.set("lastName", lastName);

    await signIn("password", formData);
    setLoading(false);
    setError("Verification code resent to your email.");
  };

  // Navigation
  const handleBackToPassword = () => {
    setSignUpStep("password");
    setVerificationCode("");
    setError(null);
  };

  const handleBackToProfile = () => {
    setSignUpStep("profile");
    setError(null);
  };

  const toggleFlow = () => {
    setFlow(flow === "signIn" ? "signUp" : "signIn");
    setSignUpStep("profile");
    setError(null);
    setPassword("");
    setConfirmPassword("");
    setVerificationCode("");
  };

  // ==================== SIGN IN FLOW ====================
  if (flow === "signIn") {
    return (
      <div className="space-y-6">
        <h4
          className="font-semibold text-lg"
          style={{ color: "var(--color-text-primary)" }}
        >
          Sign in to Ourin
        </h4>

        <form onSubmit={handleSignIn} className="space-y-4">
          {error && (
            <div
              className="px-4 py-3 rounded-sm text-sm"
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                color: "#ef4444",
              }}
            >
              {error}
            </div>
          )}

          {/* Email */}
          <div>
            <label
              className="block mb-1.5 font-medium text-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              required
              className="px-3 py-2.5 border rounded-sm focus:outline-none w-full text-sm transition-colors"
              style={{
                backgroundColor: "var(--color-background-tertiary)",
                borderColor: "var(--color-border-default)",
                color: "var(--color-text-primary)",
              }}
            />
          </div>

          {/* Password */}
          <div>
            <label
              className="block mb-1.5 font-medium text-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="py-2.5 pr-10 pl-3 border rounded-sm focus:outline-none w-full text-sm transition-colors"
                style={{
                  backgroundColor: "var(--color-background-tertiary)",
                  borderColor: "var(--color-border-default)",
                  color: "var(--color-text-primary)",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="top-1/2 right-3 absolute p-0.5 -translate-y-1/2"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="disabled:opacity-50 py-2.5 rounded-sm w-full font-medium text-white text-sm transition-colors"
            style={{ backgroundColor: "var(--color-accent-primary)" }}
          >
            {loading ? (
              <Loader2 className="mx-auto w-5 h-5 animate-spin" />
            ) : (
              "Sign in"
            )}
          </button>

          {/* Toggle to sign up */}
          <p
            className="text-sm text-center"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Don't have an account?{" "}
            <button
              type="button"
              onClick={toggleFlow}
              className="font-medium hover:underline"
              style={{ color: "var(--color-accent-primary)" }}
            >
              Sign up
            </button>
          </p>
        </form>
      </div>
    );
  }

  // ==================== SIGN UP FLOW ====================

  // Step 3: Verification
  if (signUpStep === "verification") {
    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={handleBackToPassword}
              className="hover:bg-[var(--color-background-hover)] p-1 rounded-sm transition-colors"
              style={{ color: "var(--color-text-secondary)" }}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h4
              className="font-semibold text-lg"
              style={{ color: "var(--color-text-primary)" }}
            >
              Verify your email
            </h4>
          </div>
          <p
            className="text-sm"
            style={{ color: "var(--color-text-secondary)" }}
          >
            We sent a verification code to{" "}
            <span style={{ color: "var(--color-text-primary)" }}>{email}</span>
          </p>
        </div>

        <form onSubmit={handleVerificationSubmit} className="space-y-4">
          {error && (
            <div
              className="px-4 py-3 rounded-sm text-sm"
              style={{
                backgroundColor: error.includes("resent")
                  ? "rgba(34, 197, 94, 0.1)"
                  : "rgba(239, 68, 68, 0.1)",
                color: error.includes("resent") ? "#22c55e" : "#ef4444",
              }}
            >
              {error}
            </div>
          )}

          {/* Verification Code */}
          <div>
            <label
              className="block mb-1.5 font-medium text-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Verification Code
            </label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) =>
                setVerificationCode(
                  e.target.value.replace(/\D/g, "").slice(0, 8)
                )
              }
              placeholder="Enter code"
              required
              autoFocus
              className="px-3 py-2.5 border rounded-sm focus:outline-none w-full text-sm text-center tracking-widest transition-colors"
              style={{
                backgroundColor: "var(--color-background-tertiary)",
                borderColor: "var(--color-border-default)",
                color: "var(--color-text-primary)",
              }}
            />
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading || verificationCode.length < 6}
            className="disabled:opacity-50 py-2.5 rounded-sm w-full font-medium text-white text-sm transition-colors"
            style={{ backgroundColor: "var(--color-accent-primary)" }}
          >
            {loading ? (
              <Loader2 className="mx-auto w-5 h-5 animate-spin" />
            ) : (
              "Verify"
            )}
          </button>

          {/* Resend */}
          <p
            className="text-sm text-center"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Didn't receive the code?{" "}
            <button
              type="button"
              onClick={handleResendCode}
              disabled={loading}
              className="disabled:opacity-50 font-medium hover:underline"
              style={{ color: "var(--color-accent-primary)" }}
            >
              Resend
            </button>
          </p>
        </form>
      </div>
    );
  }

  // Step 2: Password
  if (signUpStep === "password") {
    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={handleBackToProfile}
              className="hover:bg-[var(--color-background-hover)] p-1 rounded-sm transition-colors"
              style={{ color: "var(--color-text-secondary)" }}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h4
              className="font-semibold text-lg"
              style={{ color: "var(--color-text-primary)" }}
            >
              Create a password
            </h4>
          </div>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          {error && (
            <div
              className="px-4 py-3 rounded-sm text-sm"
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                color: "#ef4444",
              }}
            >
              {error}
            </div>
          )}

          {/* Password */}
          <div>
            <label
              className="block mb-1.5 font-medium text-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="py-2.5 pr-10 pl-3 border rounded-sm focus:outline-none w-full text-sm transition-colors"
                style={{
                  backgroundColor: "var(--color-background-tertiary)",
                  borderColor: "var(--color-border-default)",
                  color: "var(--color-text-primary)",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="top-1/2 right-3 absolute p-0.5 -translate-y-1/2"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label
              className="block mb-1.5 font-medium text-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                className="py-2.5 pr-10 pl-3 border rounded-sm focus:outline-none w-full text-sm transition-colors"
                style={{
                  backgroundColor: "var(--color-background-tertiary)",
                  borderColor: "var(--color-border-default)",
                  color: "var(--color-text-primary)",
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="top-1/2 right-3 absolute p-0.5 -translate-y-1/2"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Password requirements - dynamic coloring */}
          <p className="text-xs leading-relaxed">
            {password.length === 0 ? (
              // Empty state - all muted
              <span style={{ color: "var(--color-text-muted)" }}>
                Passwords must match, be at least 8 characters long, and include
                a mix of lowercase and uppercase letters, numbers, and symbols.
              </span>
            ) : (
              // Active state - colored based on validation
              <>
                <span
                  style={{
                    color: passwordValidation.passwordsMatch
                      ? "#22c55e"
                      : "#ef4444",
                  }}
                >
                  Passwords must match
                </span>
                <span style={{ color: "var(--color-text-muted)" }}>
                  , be at least{" "}
                </span>
                <span
                  style={{
                    color: passwordValidation.minLength ? "#22c55e" : "#ef4444",
                  }}
                >
                  8 characters long
                </span>
                <span style={{ color: "var(--color-text-muted)" }}>
                  , and include a mix of{" "}
                </span>
                <span
                  style={{
                    color: passwordValidation.hasLowercase
                      ? "#22c55e"
                      : "#ef4444",
                  }}
                >
                  lowercase
                </span>
                <span style={{ color: "var(--color-text-muted)" }}> and </span>
                <span
                  style={{
                    color: passwordValidation.hasUppercase
                      ? "#22c55e"
                      : "#ef4444",
                  }}
                >
                  uppercase letters
                </span>
                <span style={{ color: "var(--color-text-muted)" }}>, </span>
                <span
                  style={{
                    color: passwordValidation.hasNumber ? "#22c55e" : "#ef4444",
                  }}
                >
                  numbers
                </span>
                <span style={{ color: "var(--color-text-muted)" }}>, and </span>
                <span
                  style={{
                    color: passwordValidation.hasSymbol ? "#22c55e" : "#ef4444",
                  }}
                >
                  symbols
                </span>
              </>
            )}
          </p>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading || !isPasswordValid}
            className="disabled:opacity-50 py-2.5 rounded-sm w-full font-medium text-white text-sm transition-colors"
            style={{ backgroundColor: "var(--color-accent-primary)" }}
          >
            {loading ? (
              <Loader2 className="mx-auto w-5 h-5 animate-spin" />
            ) : (
              "Complete Sign Up"
            )}
          </button>

          {/* Toggle to sign in */}
          <p
            className="text-sm text-center"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Already have an account?{" "}
            <button
              type="button"
              onClick={toggleFlow}
              className="font-medium hover:underline"
              style={{ color: "var(--color-accent-primary)" }}
            >
              Sign in
            </button>
          </p>
        </form>
      </div>
    );
  }

  // Step 1: Profile (First Name, Last Name, Email)
  return (
    <div className="space-y-6">
      <h4
        className="font-semibold text-lg"
        style={{ color: "var(--color-text-primary)" }}
      >
        Create an Ourin account
      </h4>

      <form onSubmit={handleProfileContinue} className="space-y-4">
        {error && (
          <div
            className="px-4 py-3 rounded-sm text-sm"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              color: "#ef4444",
            }}
          >
            {error}
          </div>
        )}

        {/* First Name / Last Name row */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label
              className="block mb-1.5 font-medium text-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              First Name
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Enter your first name"
              required
              className="px-3 py-2.5 border rounded-sm focus:outline-none w-full text-sm transition-colors"
              style={{
                backgroundColor: "var(--color-background-tertiary)",
                borderColor: "var(--color-border-default)",
                color: "var(--color-text-primary)",
              }}
            />
          </div>
          <div className="flex-1">
            <label
              className="block mb-1.5 font-medium text-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Last Name
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Enter your last name"
              required
              className="px-3 py-2.5 border rounded-sm focus:outline-none w-full text-sm transition-colors"
              style={{
                backgroundColor: "var(--color-background-tertiary)",
                borderColor: "var(--color-border-default)",
                color: "var(--color-text-primary)",
              }}
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label
            className="block mb-1.5 font-medium text-sm"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            required
            className="px-3 py-2.5 border rounded-sm focus:outline-none w-full text-sm transition-colors"
            style={{
              backgroundColor: "var(--color-background-tertiary)",
              borderColor: "var(--color-border-default)",
              color: "var(--color-text-primary)",
            }}
          />
        </div>

        {/* Continue button */}
        <button
          type="submit"
          disabled={loading || !firstName || !lastName || !email}
          className="disabled:opacity-50 py-2.5 rounded-sm w-full font-medium text-white text-sm transition-colors"
          style={{ backgroundColor: "var(--color-accent-primary)" }}
        >
          Continue
        </button>

        {/* Toggle to sign in */}
        <p
          className="text-sm text-center"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Already have an account?{" "}
          <button
            type="button"
            onClick={toggleFlow}
            className="font-medium hover:underline"
            style={{ color: "var(--color-accent-primary)" }}
          >
            Sign in
          </button>
        </p>
      </form>
    </div>
  );
}

function AuthenticatedAccount() {
  const currentUser = useQuery(api.settings.getCurrentUser);
  const { isSelfHosting, isLoading: isLoadingProductionMode } =
    useProductionMode();

  // Billing state
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [isLoadingBuyCredits, setIsLoadingBuyCredits] = useState(false);
  const [billingConfig, setBillingConfig] =
    useState<BillingConfig>(DEFAULT_CONFIG);
  const [showPurchaseHistory, setShowPurchaseHistory] = useState(false);
  const historyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Billing queries - skip in self-hosting mode
  const tierInfo = useQuery(
    api.billing.getUserTier,
    isSelfHosting ? "skip" : {}
  );
  const usageSummary = useQuery(
    api.usage.getUsageSummary,
    isSelfHosting ? "skip" : {}
  );
  const purchaseHistory = useQuery(
    api.creditPurchases.getPurchaseHistory,
    isSelfHosting ? "skip" : {}
  );
  const generateChatToken = useMutation(api.chatAuth.generateChatToken);

  const handleMouseEnter = () => {
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current);
    }
    setShowPurchaseHistory(true);
  };

  const handleMouseLeave = () => {
    historyTimeoutRef.current = setTimeout(() => {
      setShowPurchaseHistory(false);
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (historyTimeoutRef.current) {
        clearTimeout(historyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    fetch("/api/billing/config")
      .then((res) => res.json())
      .then((data) => setBillingConfig(data))
      .catch(() => {});
  }, []);

  const handleSubscribe = async () => {
    setIsLoadingCheckout(true);
    try {
      const tokenResult = await generateChatToken();
      if (!tokenResult) {
        toast.error("Please sign in to subscribe");
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
    } finally {
      setIsLoadingCheckout(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsLoadingPortal(true);
    try {
      const tokenResult = await generateChatToken();
      if (!tokenResult) {
        toast.error("Please sign in");
        return;
      }
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenResult.token}`,
        },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error("Failed to create portal session");
      const { url } = await response.json();
      if (url) window.location.href = url;
    } catch (error) {
      console.error("Portal error:", error);
      toast.error("Failed to open billing portal", {
        description: "Please try again.",
      });
    } finally {
      setIsLoadingPortal(false);
    }
  };

  const handleBuyCredits = async () => {
    setIsLoadingBuyCredits(true);
    try {
      const tokenResult = await generateChatToken();
      if (!tokenResult) {
        toast.error("Please sign in");
        return;
      }
      const response = await fetch("/api/stripe/buy-credits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenResult.token}`,
        },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create checkout session");
      }
      const { url } = await response.json();
      if (url) window.location.href = url;
    } catch (error) {
      console.error("Buy credits error:", error);
      toast.error("Failed to start checkout", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsLoadingBuyCredits(false);
    }
  };

  if (
    currentUser === undefined ||
    isLoadingProductionMode ||
    (!isSelfHosting && tierInfo === undefined)
  ) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2
          className="w-6 h-6 animate-spin"
          style={{ color: "var(--color-text-tertiary)" }}
        />
      </div>
    );
  }

  // In self-hosting mode, show a simple message - no billing UI
  if (isSelfHosting) {
    return (
      <div className="space-y-6">
        <SettingsSection title="Account">
          <div
            className="p-4 border rounded-sm"
            style={{
              backgroundColor: "var(--color-background-tertiary)",
              borderColor: "var(--color-border-default)",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex justify-center items-center rounded-sm w-10 h-10"
                style={{ backgroundColor: "var(--color-background-hover)" }}
              >
                <Zap
                  className="w-5 h-5"
                  style={{ color: "var(--color-accent-primary)" }}
                />
              </div>
              <div>
                <h5
                  className="font-medium"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Self-Hosted Mode
                </h5>
                <p
                  className="text-sm"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  All models available with no restrictions
                </p>
              </div>
            </div>
          </div>
        </SettingsSection>
      </div>
    );
  }

  // After the early returns above, tierInfo is guaranteed to be defined
  // in non-self-hosting mode. Add explicit guard for TypeScript narrowing.
  if (!tierInfo) {
    return null;
  }

  const isSubscriber = tierInfo.tier === "subscriber";
  const isFree = tierInfo.tier === "free";
  const isOwnKeys = tierInfo.tier === "own_keys";

  return (
    <div className="space-y-6">
      {/* Current plan - for non-subscribers */}
      {!isSubscriber && (
        <>
          <SettingsSection title="Current Plan">
            <div
              className="p-4 border rounded-sm"
              style={{
                backgroundColor: "var(--color-background-tertiary)",
                borderColor: "var(--color-border-default)",
              }}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div
                    className="flex justify-center items-center rounded-sm w-10 h-10"
                    style={{ backgroundColor: "var(--color-background-hover)" }}
                  >
                    {isOwnKeys ? (
                      <Key
                        className="w-5 h-5"
                        style={{ color: "var(--color-text-secondary)" }}
                      />
                    ) : (
                      <Zap
                        className="w-5 h-5"
                        style={{ color: "var(--color-text-secondary)" }}
                      />
                    )}
                  </div>
                  <div>
                    <h5
                      className="font-medium"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {isOwnKeys ? "API Keys" : "Free Plan"}
                    </h5>
                    <p
                      className="text-sm"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {isOwnKeys
                        ? "Using your own API keys"
                        : `${
                            tierInfo.remainingMessages ??
                            FREE_TIER_MESSAGE_LIMIT
                          } of ${FREE_TIER_MESSAGE_LIMIT} free messages remaining`}
                    </p>
                  </div>
                </div>
              </div>
              {isFree && (
                <div className="mt-4">
                  <div className="flex justify-between mb-1 text-xs">
                    <span style={{ color: "var(--color-text-muted)" }}>
                      Messages used
                    </span>
                    <span style={{ color: "var(--color-text-secondary)" }}>
                      {tierInfo.messageCount ?? 0} / {FREE_TIER_MESSAGE_LIMIT}
                    </span>
                  </div>
                  <div
                    className="rounded-full h-2 overflow-hidden"
                    style={{ backgroundColor: "var(--color-background-hover)" }}
                  >
                    <div
                      className="rounded-full h-full transition-all"
                      style={{
                        width: `${
                          ((tierInfo.messageCount ?? 0) /
                            FREE_TIER_MESSAGE_LIMIT) *
                          100
                        }%`,
                        backgroundColor:
                          (tierInfo.messageCount ?? 0) >=
                          FREE_TIER_WARNING_THRESHOLD
                            ? "#ef4444"
                            : "var(--color-accent-primary)",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </SettingsSection>

          <SettingsDivider />

          {/* Upgrade to Pro */}
          <div
            className="p-5 rounded-md"
            style={{
              backgroundColor: "var(--color-background-tertiary)",
              border: "1px solid var(--color-border-default)",
            }}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <h4
                className="font-semibold text-base"
                style={{ color: "var(--color-text-primary)" }}
              >
                Upgrade to Pro
              </h4>
              <div>
                <span
                  className="font-bold text-xl"
                  style={{ color: "var(--color-accent-primary)" }}
                >
                  $10
                </span>
                <span
                  className="text-sm"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  /month
                </span>
              </div>
            </div>

            {/* Feature list */}
            <ul className="space-y-3 mb-5">
              {[
                {
                  icon: Sparkles,
                  title: "All Models",
                  description: "Claude Opus, o3, Gemini Pro, and more",
                },
                {
                  icon: InfinityIcon,
                  title: "Generous Limits",
                  description: `${(billingConfig.subscriptionCredits ?? 10000).toLocaleString()} credits/month, buy more anytime`,
                },
                {
                  icon: Zap,
                  title: "Premium Features",
                  description: "Web search, image uploads, BYOK",
                },
              ].map((feature) => (
                <li key={feature.title} className="flex items-start gap-3">
                  <div
                    className="flex flex-shrink-0 justify-center items-center mt-0.5 rounded w-6 h-6"
                    style={{
                      backgroundColor: "var(--color-accent-primary-muted)",
                    }}
                  >
                    <feature.icon
                      className="w-3.5 h-3.5"
                      style={{ color: "var(--color-accent-primary)" }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span
                      className="font-medium text-sm"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {feature.title}
                    </span>
                    <span
                      className="text-sm"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {" "}
                      — {feature.description}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            {/* Upgrade button */}
            <button
              onClick={handleSubscribe}
              disabled={isLoadingCheckout}
              className="flex justify-center items-center gap-2 px-6 py-2.5 rounded-sm w-full font-medium text-sm transition-colors"
              style={{
                backgroundColor: "var(--color-accent-primary)",
                color: "var(--color-text-inverse)",
              }}
            >
              {isLoadingCheckout ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Upgrade Now"
              )}
            </button>
          </div>

          <SettingsDivider />
        </>
      )}

      {/* Subscriber sections */}
      {isSubscriber && usageSummary && (
        <>
          <SettingsSection title="Usage">
            <div
              className="p-4 border rounded-sm"
              style={{
                backgroundColor: "var(--color-background-tertiary)",
                borderColor: "var(--color-border-default)",
              }}
            >
              <div className="flex justify-between items-center mb-2">
                <span
                  className="font-medium text-sm"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Monthly Credit Usage
                </span>
                <span
                  className="font-medium text-sm"
                  style={{
                    color:
                      (usageSummary.subscriptionBalance ?? 0) > 0
                        ? "var(--color-text-primary)"
                        : "#ef4444",
                  }}
                >
                  {(usageSummary.subscriptionBalance ?? 0).toLocaleString()}
                  <span style={{ color: "var(--color-text-muted)" }}>
                    {" "}
                    /{" "}
                    {(
                      billingConfig.subscriptionCredits ?? 10000
                    ).toLocaleString()}
                  </span>
                </span>
              </div>
              <div
                className="rounded-full h-3 overflow-hidden"
                style={{ backgroundColor: "var(--color-background-hover)" }}
              >
                <div
                  className="rounded-full h-full transition-all"
                  style={{
                    width: `${Math.max(
                      0,
                      ((usageSummary.subscriptionBalance ?? 0) /
                        (billingConfig.subscriptionCredits ?? 10000)) *
                        100
                    )}%`,
                    backgroundColor:
                      (usageSummary.subscriptionBalance ?? 0) >
                      (billingConfig.subscriptionCredits ?? 10000) * 0.25
                        ? "var(--color-accent-primary)"
                        : "#ef4444",
                  }}
                />
              </div>
            </div>
          </SettingsSection>

          <SettingsDivider />

          <SettingsSection title="Credits">
            <div
              className="border rounded-sm overflow-hidden"
              style={{
                backgroundColor: "var(--color-background-tertiary)",
                borderColor: "var(--color-border-default)",
              }}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <div className="p-4 cursor-pointer">
                <div className="flex justify-between items-center">
                  <span
                    className="flex items-center gap-1.5 font-medium text-sm"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    Purchased Credits Remaining
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        showPurchaseHistory ? "rotate-180" : ""
                      }`}
                      style={{ color: "var(--color-text-muted)" }}
                    />
                  </span>
                  <span
                    className="font-medium text-sm"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {(usageSummary.purchasedBalance ?? 0).toLocaleString()}
                  </span>
                </div>
                <p
                  className="mt-2 text-xs"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Never expire. Used after plan allowance.
                </p>
              </div>
              <div
                className={`transition-all duration-200 ease-out overflow-hidden ${
                  showPurchaseHistory ? "max-h-64" : "max-h-0"
                }`}
              >
                <div
                  className="px-4 pt-2 pb-4 border-t"
                  style={{ borderColor: "var(--color-border-default)" }}
                >
                  <span
                    className="block mb-2 font-medium text-xs"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Purchase History
                  </span>
                  {purchaseHistory && purchaseHistory.length > 0 ? (
                    <div className="space-y-2 max-h-44 overflow-y-auto">
                      {purchaseHistory.map((purchase) => (
                        <div
                          key={purchase.id}
                          className="flex justify-between items-center py-1.5 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                purchase.status === "active"
                                  ? "bg-green-500/10 text-green-500"
                                  : "bg-gray-500/10 text-gray-500"
                              }`}
                            >
                              {purchase.status === "active" ? "Active" : "Used"}
                            </span>
                            <span
                              style={{ color: "var(--color-text-secondary)" }}
                            >
                              {new Date(
                                purchase.purchasedAt
                              ).toLocaleDateString()}
                            </span>
                          </div>
                          <span style={{ color: "var(--color-text-primary)" }}>
                            {purchase.creditsRemaining.toLocaleString()}
                            <span style={{ color: "var(--color-text-muted)" }}>
                              /{purchase.creditsAmount.toLocaleString()}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p
                      className="text-xs"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      No purchases yet
                    </p>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleBuyCredits}
              disabled={isLoadingBuyCredits}
              className="flex justify-center items-center gap-2 px-4 py-2.5 rounded-sm w-full font-medium text-sm transition-colors"
              style={{
                backgroundColor: "var(--color-accent-primary)",
                color: "var(--color-text-inverse)",
              }}
            >
              {isLoadingBuyCredits ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Coins className="w-4 h-4" />
                  Buy Credits — $
                  {(billingConfig.creditPackPriceCents ?? 2000) / 100} for{" "}
                  {(billingConfig.creditPackAmount ?? 20000).toLocaleString()}{" "}
                  credits
                </>
              )}
            </button>
          </SettingsSection>

          <SettingsDivider />

          <SettingsSection
            title="Subscription"
            description="Manage your subscription and billing."
          >
            <button
              onClick={handleManageSubscription}
              disabled={isLoadingPortal}
              className="flex justify-center items-center gap-2 px-4 py-2.5 rounded-sm w-full font-medium text-sm transition-colors"
              style={{
                backgroundColor: "var(--color-background-hover)",
                color: "var(--color-text-secondary)",
                border: "1px solid var(--color-border-default)",
              }}
            >
              {isLoadingPortal ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Manage Subscription
                  <ExternalLink className="w-3 h-3" />
                </>
              )}
            </button>
          </SettingsSection>
        </>
      )}
    </div>
  );
}

interface AccountTabProps {
  signUpStep: SignUpStep;
  setSignUpStep: (step: SignUpStep) => void;
  flow: AuthFlow;
  setFlow: (flow: AuthFlow) => void;
}

export function AccountTab({
  signUpStep,
  setSignUpStep,
  flow,
  setFlow,
}: AccountTabProps) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const currentUser = useQuery(
    api.settings.getCurrentUser,
    isAuthenticated ? {} : "skip"
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2
          className="w-6 h-6 animate-spin"
          style={{ color: "var(--color-text-tertiary)" }}
        />
      </div>
    );
  }

  // In self-hosting mode, skip auth form - go straight to AuthenticatedAccount
  // (which shows "Self-Hosted Mode" message)
  // In production mode, show auth form if not authenticated, anonymous, or email not verified
  if (
    !IS_SELF_HOSTING_CLIENT &&
    (!isAuthenticated ||
      currentUser?.isAnonymous ||
      !currentUser?.emailVerified)
  ) {
    return (
      <AuthForm
        signUpStep={signUpStep}
        setSignUpStep={setSignUpStep}
        flow={flow}
        setFlow={setFlow}
      />
    );
  }

  // Still loading user data
  if (currentUser === undefined) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2
          className="w-6 h-6 animate-spin"
          style={{ color: "var(--color-text-tertiary)" }}
        />
      </div>
    );
  }

  return <AuthenticatedAccount />;
}
