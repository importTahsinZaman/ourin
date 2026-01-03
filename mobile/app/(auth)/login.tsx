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
import { useState } from "react";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthActions } from "@convex-dev/auth/react";

export default function LoginScreen() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please enter email and password");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("email", email.toLowerCase().trim());
      formData.append("password", password);
      formData.append("flow", flow);

      const result = await signIn("password", formData);

      if (result && typeof result === "object" && "signingIn" in result) {
        if (flow === "signUp") {
          // Signup sends OTP - navigate to verify screen
          router.push({
            pathname: "/(auth)/verify",
            params: { email: email.toLowerCase().trim(), password },
          });
        } else if (result.signingIn === false) {
          // Sign in failed - wrong credentials
          setError("Invalid email or password");
        } else {
          // Sign in success - navigate to main app
          router.replace("/(tabs)");
        }
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
      console.error("Auth error:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFlow = () => {
    setFlow(flow === "signIn" ? "signUp" : "signIn");
    setError(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <Text style={styles.title}>
            {flow === "signIn" ? "Welcome back" : "Create account"}
          </Text>
          <Text style={styles.subtitle}>
            {flow === "signIn"
              ? "Sign in to your Ourin account"
              : "Enter your email to get started"}
          </Text>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="••••••••"
                placeholderTextColor="#666"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
                editable={!loading}
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.eyeText}>
                  {showPassword ? "Hide" : "Show"}
                </Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {flow === "signIn" ? "Sign in" : "Create account"}
              </Text>
            )}
          </Pressable>

          <View style={styles.toggleContainer}>
            <Text style={styles.toggleText}>
              {flow === "signIn"
                ? "Don't have an account?"
                : "Already have an account?"}{" "}
            </Text>
            <Pressable onPress={toggleFlow} disabled={loading}>
              <Text style={styles.toggleLink}>
                {flow === "signIn" ? "Sign up" : "Sign in"}
              </Text>
            </Pressable>
          </View>
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
  },
  errorContainer: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 14,
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
  input: {
    backgroundColor: "#262626",
    borderWidth: 1,
    borderColor: "#404040",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#f5f5f4",
  },
  passwordContainer: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 60,
  },
  eyeButton: {
    position: "absolute",
    right: 16,
    top: 16,
  },
  eyeText: {
    color: "#a3a3a3",
    fontSize: 14,
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
  toggleContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  toggleText: {
    color: "#a3a3a3",
    fontSize: 14,
  },
  toggleLink: {
    color: "#d97756",
    fontSize: 14,
    fontWeight: "600",
  },
});
