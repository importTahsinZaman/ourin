"use client";

import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  X,
  Mail,
  Lock,
  Loader2,
  Eye,
  EyeOff,
  KeyRound,
  ArrowLeft,
} from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [step, setStep] = useState<"credentials" | "verification">(
    "credentials"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.set("email", email);
    formData.set("password", password);
    formData.set("flow", flow);

    const result = await signIn("password", formData);

    // Handle result based on flow
    if (result && typeof result === "object" && "signingIn" in result) {
      if (flow === "signUp") {
        // For signup with email verification, signingIn: false means OTP was sent
        // Show verification step regardless of signingIn value
        setStep("verification");
        setLoading(false);
      } else if (result.signingIn === false) {
        // For signin, signingIn: false means wrong credentials
        setError("Invalid email or password");
        setLoading(false);
      }
    }
    // On success, auth state updates automatically and HomeClient will re-render
  };

  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.set("email", email);
    formData.set("code", verificationCode);
    formData.set("flow", "email-verification");

    const result = await signIn("password", formData);

    if (result && "signingIn" in result && !result.signingIn) {
      setError("Invalid verification code. Please try again.");
      setLoading(false);
    }
    // On success, auth state updates automatically
  };

  const handleResendCode = async () => {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.set("email", email);
    formData.set("password", password);
    formData.set("flow", "signUp");

    await signIn("password", formData);
    setLoading(false);
    setError("Verification code resent to your email.");
  };

  const handleBackToCredentials = () => {
    setStep("credentials");
    setVerificationCode("");
    setError(null);
  };

  const toggleFlow = () => {
    setFlow(flow === "signIn" ? "signUp" : "signIn");
    setStep("credentials");
    setVerificationCode("");
    setError(null);
  };

  // Verification step UI (after signup sends OTP)
  if (step === "verification") {
    return (
      <div className="z-50 fixed inset-0 flex justify-center items-center">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />

        {/* Modal */}
        <div
          className="relative shadow-2xl mx-4 rounded-sm w-full max-w-md"
          style={{ backgroundColor: "var(--color-background-elevated)" }}
        >
          {/* Header */}
          <div
            className="flex justify-between items-center px-6 py-4 border-b"
            style={{ borderColor: "var(--color-border-default)" }}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToCredentials}
                className="hover:bg-black/5 p-1 rounded-sm transition-colors"
                style={{ color: "var(--color-text-secondary)" }}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2
                className="font-semibold text-xl"
                style={{ color: "var(--color-text-primary)" }}
              >
                Verify your email
              </h2>
            </div>
            <button
              onClick={onClose}
              className="hover:bg-black/5 p-2 rounded-sm transition-colors"
              style={{ color: "var(--color-text-secondary)" }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Verification Form */}
          <form onSubmit={handleVerificationSubmit} className="space-y-4 p-6">
            <p
              className="text-sm text-center"
              style={{ color: "var(--color-text-secondary)" }}
            >
              We sent a verification code to{" "}
              <span style={{ color: "var(--color-text-primary)" }}>
                {email}
              </span>
            </p>

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
                className="block mb-2 font-medium text-sm"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Verification Code
              </label>
              <div className="relative">
                <KeyRound
                  className="top-1/2 left-3 absolute w-5 h-5 -translate-y-1/2"
                  style={{ color: "var(--color-text-tertiary)" }}
                />
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
                  className="py-3 pr-4 pl-10 border rounded-sm focus:outline-none w-full text-sm text-center tracking-widest transition-colors"
                  style={{
                    backgroundColor: "var(--color-background-tertiary)",
                    borderColor: "var(--color-border-default)",
                    color: "var(--color-text-primary)",
                  }}
                />
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading || verificationCode.length < 6}
              className="disabled:opacity-50 py-3 rounded-sm w-full font-medium text-white text-sm transition-colors"
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
      </div>
    );
  }

  // Credentials step UI (email + password form)
  return (
    <div className="z-50 fixed inset-0 flex justify-center items-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative shadow-2xl mx-4 rounded-sm w-full max-w-md"
        style={{ backgroundColor: "var(--color-background-elevated)" }}
      >
        {/* Header */}
        <div
          className="flex justify-between items-center px-6 py-4 border-b"
          style={{ borderColor: "var(--color-border-default)" }}
        >
          <h2
            className="font-semibold text-xl"
            style={{ color: "var(--color-text-primary)" }}
          >
            {flow === "signIn" ? "Welcome back" : "Create account"}
          </h2>
          <button
            onClick={onClose}
            className="hover:bg-black/5 p-2 rounded-sm transition-colors"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
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
              className="block mb-2 font-medium text-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Email
            </label>
            <div className="relative">
              <Mail
                className="top-1/2 left-3 absolute w-5 h-5 -translate-y-1/2"
                style={{ color: "var(--color-text-tertiary)" }}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="py-3 pr-4 pl-10 border rounded-sm focus:outline-none w-full text-sm transition-colors"
                style={{
                  backgroundColor: "var(--color-background-tertiary)",
                  borderColor: "var(--color-border-default)",
                  color: "var(--color-text-primary)",
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label
              className="block mb-2 font-medium text-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Password
            </label>
            <div className="relative">
              <Lock
                className="top-1/2 left-3 absolute w-5 h-5 -translate-y-1/2"
                style={{ color: "var(--color-text-tertiary)" }}
              />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="py-3 pr-12 pl-10 border rounded-sm focus:outline-none w-full text-sm transition-colors"
                style={{
                  backgroundColor: "var(--color-background-tertiary)",
                  borderColor: "var(--color-border-default)",
                  color: "var(--color-text-primary)",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="top-1/2 right-3 absolute p-1 -translate-y-1/2"
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
            className="disabled:opacity-50 py-3 rounded-sm w-full font-medium text-white text-sm transition-colors"
            style={{ backgroundColor: "var(--color-accent-primary)" }}
          >
            {loading ? (
              <Loader2 className="mx-auto w-5 h-5 animate-spin" />
            ) : flow === "signIn" ? (
              "Sign in"
            ) : (
              "Create account"
            )}
          </button>

          {/* Toggle */}
          <p
            className="text-sm text-center"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {flow === "signIn"
              ? "Don't have an account?"
              : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={toggleFlow}
              className="font-medium hover:underline"
              style={{ color: "var(--color-accent-primary)" }}
            >
              {flow === "signIn" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
