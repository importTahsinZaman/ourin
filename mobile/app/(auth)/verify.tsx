import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useState, useEffect, useRef } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthActions } from "@convex-dev/auth/react";

export default function VerifyScreen() {
  const { signIn } = useAuthActions();
  const params = useLocalSearchParams<{ email: string; password: string }>();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRef = useRef<TextInput>(null);

  // Start cooldown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(
        () => setResendCooldown(resendCooldown - 1),
        1000
      );
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleVerify = async () => {
    if (code.length < 6) {
      setError("Please enter the verification code");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("email", params.email || "");
      formData.append("code", code);
      formData.append("flow", "email-verification");

      const result = await signIn("password", formData);

      if (result && "signingIn" in result && !result.signingIn) {
        setError("Invalid verification code. Please try again.");
      } else {
        // Success - navigate to main app
        router.replace("/(tabs)");
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
      console.error("Verification error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("email", params.email || "");
      formData.append("password", params.password || "");
      formData.append("flow", "signUp");

      await signIn("password", formData);
      setError("Verification code resent to your email.");
      setResendCooldown(60); // 60 second cooldown
      setCode(""); // Clear old code
    } catch (err) {
      setError("Failed to resend code. Please try again.");
      console.error("Resend error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (text: string) => {
    // Only allow digits, max 8 characters
    const cleaned = text.replace(/\D/g, "").slice(0, 8);
    setCode(cleaned);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a verification code to{"\n"}
            <Text style={styles.emailText}>{params.email}</Text>
          </Text>

          {error && (
            <View
              style={[
                styles.messageContainer,
                error.includes("resent")
                  ? styles.successContainer
                  : styles.errorContainer,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  error.includes("resent")
                    ? styles.successText
                    : styles.errorText,
                ]}
              >
                {error}
              </Text>
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Verification Code</Text>
            <TextInput
              ref={inputRef}
              style={styles.codeInput}
              placeholder="Enter 8-digit code"
              placeholderTextColor="#666"
              value={code}
              onChangeText={handleCodeChange}
              keyboardType="number-pad"
              maxLength={8}
              editable={!loading}
            />
          </View>

          <Pressable
            style={[
              styles.button,
              (loading || code.length < 6) && styles.buttonDisabled,
            ]}
            onPress={handleVerify}
            disabled={loading || code.length < 6}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Verify</Text>
            )}
          </Pressable>

          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Didn't receive the code? </Text>
            <Pressable
              onPress={handleResend}
              disabled={loading || resendCooldown > 0}
            >
              <Text
                style={[
                  styles.resendLink,
                  (loading || resendCooldown > 0) && styles.resendDisabled,
                ]}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend"}
              </Text>
            </Pressable>
          </View>

          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={styles.backText}>Back to sign in</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
    color: "#f5f5f4",
  },
  subtitle: {
    fontSize: 16,
    color: "#a3a3a3",
    marginBottom: 32,
    lineHeight: 24,
  },
  emailText: {
    color: "#f5f5f4",
    fontWeight: "500",
  },
  messageContainer: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorContainer: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  successContainer: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
  },
  messageText: {
    fontSize: 14,
  },
  errorText: {
    color: "#ef4444",
  },
  successText: {
    color: "#22c55e",
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#a3a3a3",
    marginBottom: 8,
  },
  codeInput: {
    backgroundColor: "#262626",
    borderWidth: 1,
    borderColor: "#404040",
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    color: "#f5f5f4",
    textAlign: "center",
    letterSpacing: 8,
  },
  button: {
    backgroundColor: "#d97756",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  resendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  resendText: {
    color: "#a3a3a3",
    fontSize: 14,
  },
  resendLink: {
    color: "#d97756",
    fontSize: 14,
    fontWeight: "600",
  },
  resendDisabled: {
    opacity: 0.5,
  },
  backButton: {
    alignItems: "center",
    marginTop: 16,
  },
  backText: {
    color: "#a3a3a3",
    fontSize: 14,
  },
});
