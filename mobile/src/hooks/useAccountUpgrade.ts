import { useCallback, useState } from "react";
import { useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "convex/_generated/api";
import { useAuth } from "./useAuth";

/**
 * Hook for upgrading an anonymous account to a full email account.
 *
 * Flow:
 * 1. Register pending link (stores mapping: email -> anonymousUserId)
 * 2. Call signUp flow (sends OTP)
 * 3. User verifies OTP
 * 4. Convex auth callback finds pending link and upgrades account
 *
 * This preserves the user's conversation history.
 */
export function useAccountUpgrade() {
  const { signIn } = useAuthActions();
  const { user: currentUser } = useAuth();
  const registerPendingLink = useMutation(
    api.settings.registerPendingAccountLink
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAnonymous = currentUser?.isAnonymous ?? false;

  /**
   * Start the upgrade process for an anonymous user.
   * Call this BEFORE the user starts signup.
   *
   * @returns Object with success status and registration result
   */
  const startUpgrade = useCallback(
    async (email: string, password: string) => {
      if (!isAnonymous) {
        return { success: false, reason: "not_anonymous" as const };
      }

      setLoading(true);
      setError(null);

      try {
        // Step 1: Register pending link
        const linkResult = await registerPendingLink({ email });

        if (!linkResult.success) {
          setError("Failed to prepare account upgrade");
          return { success: false, reason: linkResult.reason };
        }

        // Step 2: Start signup flow (sends OTP)
        const formData = new FormData();
        formData.append("email", email.toLowerCase().trim());
        formData.append("password", password);
        formData.append("flow", "signUp");

        const signUpResult = await signIn("password", formData);

        // If signup initiated, return success for navigation to verify screen
        if (signUpResult && typeof signUpResult === "object") {
          return {
            success: true,
            email: email.toLowerCase().trim(),
            password,
          };
        }

        setError("Failed to start signup process");
        return { success: false, reason: "signup_failed" as const };
      } catch (err) {
        console.error("Account upgrade error:", err);
        setError("Something went wrong. Please try again.");
        return { success: false, reason: "error" as const };
      } finally {
        setLoading(false);
      }
    },
    [isAnonymous, registerPendingLink, signIn]
  );

  /**
   * Complete the upgrade by verifying the OTP code.
   */
  const completeUpgrade = useCallback(
    async (email: string, code: string) => {
      setLoading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("email", email);
        formData.append("code", code);
        formData.append("flow", "email-verification");

        const result = await signIn("password", formData);

        if (result && "signingIn" in result && !result.signingIn) {
          setError("Invalid verification code");
          return { success: false, reason: "invalid_code" as const };
        }

        // Success! Account is now upgraded
        return { success: true };
      } catch (err) {
        console.error("Verification error:", err);
        setError("Something went wrong. Please try again.");
        return { success: false, reason: "error" as const };
      } finally {
        setLoading(false);
      }
    },
    [signIn]
  );

  return {
    isAnonymous,
    loading,
    error,
    startUpgrade,
    completeUpgrade,
    clearError: () => setError(null),
  };
}
