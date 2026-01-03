import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useState, useEffect, useRef } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthActions } from "@convex-dev/auth/react";

type AuthFlow = "signIn" | "signUp";
type SignUpStep = "profile" | "password" | "verification";

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

export default function LoginScreen() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<AuthFlow>("signIn");
  const [signUpStep, setSignUpStep] = useState<SignUpStep>("profile");

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
  const [resendCooldown, setResendCooldown] = useState(0);

  const codeInputRef = useRef<TextInput>(null);

  // Password validation
  const passwordValidation = validatePassword(password, confirmPassword);
  const isPasswordValid = Object.values(passwordValidation).every(Boolean);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(
        () => setResendCooldown(resendCooldown - 1),
        1000
      );
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Focus code input when reaching verification step
  useEffect(() => {
    if (signUpStep === "verification") {
      setTimeout(() => codeInputRef.current?.focus(), 100);
    }
  }, [signUpStep]);

  // Reset form when switching flows
  const toggleFlow = () => {
    setFlow(flow === "signIn" ? "signUp" : "signIn");
    setSignUpStep("profile");
    setError(null);
    setPassword("");
    setConfirmPassword("");
    setVerificationCode("");
  };

  // Sign In handler
  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please enter email and password");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("email", email.toLowerCase().trim());
      formData.append("password", password);
      formData.append("flow", "signIn");

      const result = await signIn("password", formData);

      if (result && typeof result === "object" && "signingIn" in result) {
        if (result.signingIn === false) {
          setError("Invalid email or password");
        }
        // Success handled by root layout auth redirect
      }
    } catch {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  // Sign Up Step 1: Profile -> Password
  const handleProfileContinue = () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError("Please fill in all fields");
      return;
    }
    setError(null);
    setSignUpStep("password");
  };

  // Sign Up Step 2: Password -> Verification
  const handlePasswordSubmit = async () => {
    if (!isPasswordValid) {
      setError("Please ensure your password meets all requirements");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("email", email.toLowerCase().trim());
      formData.append("password", password);
      formData.append("flow", "signUp");
      formData.append("firstName", firstName.trim());
      formData.append("lastName", lastName.trim());

      await signIn("password", formData);
      setSignUpStep("verification");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Sign Up Step 3: Verification
  const handleVerificationSubmit = async () => {
    if (verificationCode.length < 6) {
      setError("Please enter the verification code");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("email", email.toLowerCase().trim());
      formData.append("code", verificationCode);
      formData.append("flow", "email-verification");
      formData.append("firstName", firstName.trim());
      formData.append("lastName", lastName.trim());

      const result = await signIn("password", formData);

      if (result && "signingIn" in result && !result.signingIn) {
        setVerificationCode("");
        setError("That code didn't work. Please check and try again.");
      }
      // Success handled by root layout auth redirect
    } catch {
      setVerificationCode("");
      setError("That code didn't work. Please check and try again.");
    } finally {
      setLoading(false);
    }
  };

  // Resend verification code
  const handleResendCode = async () => {
    if (resendCooldown > 0) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("email", email.toLowerCase().trim());
      formData.append("password", password);
      formData.append("flow", "signUp");
      formData.append("firstName", firstName.trim());
      formData.append("lastName", lastName.trim());

      await signIn("password", formData);
      setResendCooldown(60);
      setVerificationCode("");
      setError("Verification code resent to your email.");
    } catch {
      setError("Failed to resend code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Navigation
  const handleBackToProfile = () => {
    setSignUpStep("profile");
    setError(null);
  };

  const handleBackToPassword = () => {
    setSignUpStep("password");
    setVerificationCode("");
    setError(null);
  };

  // ==================== SIGN IN FLOW ====================
  if (flow === "signIn") {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to your Ourin account</Text>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email address"
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
                  placeholder="Enter your password"
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
              onPress={handleSignIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Sign in</Text>
              )}
            </Pressable>

            <View style={styles.toggleContainer}>
              <Text style={styles.toggleText}>Don't have an account? </Text>
              <Pressable onPress={toggleFlow} disabled={loading}>
                <Text style={styles.toggleLink}>Sign up</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ==================== SIGN UP FLOW ====================

  // Step 3: Verification
  if (signUpStep === "verification") {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.headerRow}>
              <Pressable
                onPress={handleBackToPassword}
                style={styles.backButton}
              >
                <Text style={styles.backText}>←</Text>
              </Pressable>
              <Text style={styles.titleSmall}>Verify your email</Text>
            </View>
            <Text style={styles.subtitle}>
              We sent a verification code to{"\n"}
              <Text style={styles.emailHighlight}>{email}</Text>
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
                ref={codeInputRef}
                style={styles.codeInput}
                placeholder="Enter code"
                placeholderTextColor="#666"
                value={verificationCode}
                onChangeText={(text) =>
                  setVerificationCode(text.replace(/\D/g, "").slice(0, 8))
                }
                keyboardType="number-pad"
                maxLength={8}
                editable={!loading}
              />
            </View>

            <Pressable
              style={[
                styles.button,
                (loading || verificationCode.length < 6) &&
                  styles.buttonDisabled,
              ]}
              onPress={handleVerificationSubmit}
              disabled={loading || verificationCode.length < 6}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verify</Text>
              )}
            </Pressable>

            <View style={styles.toggleContainer}>
              <Text style={styles.toggleText}>Didn't receive the code? </Text>
              <Pressable
                onPress={handleResendCode}
                disabled={loading || resendCooldown > 0}
              >
                <Text
                  style={[
                    styles.toggleLink,
                    (loading || resendCooldown > 0) && styles.linkDisabled,
                  ]}
                >
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : "Resend"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Step 2: Password
  if (signUpStep === "password") {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.headerRow}>
              <Pressable
                onPress={handleBackToProfile}
                style={styles.backButton}
              >
                <Text style={styles.backText}>←</Text>
              </Pressable>
              <Text style={styles.titleSmall}>Create a password</Text>
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Enter your password"
                  placeholderTextColor="#666"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
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

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Confirm your password"
                  placeholderTextColor="#666"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  editable={!loading}
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Text style={styles.eyeText}>
                    {showConfirmPassword ? "Hide" : "Show"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Password requirements */}
            <View style={styles.requirementsContainer}>
              {password.length === 0 ? (
                <Text style={styles.requirementsMuted}>
                  Passwords must match, be at least 8 characters long, and
                  include a mix of lowercase and uppercase letters, numbers, and
                  symbols.
                </Text>
              ) : (
                <Text style={styles.requirementsText}>
                  <Text
                    style={
                      passwordValidation.passwordsMatch
                        ? styles.reqValid
                        : styles.reqInvalid
                    }
                  >
                    Passwords must match
                  </Text>
                  <Text style={styles.requirementsMuted}>, be at least </Text>
                  <Text
                    style={
                      passwordValidation.minLength
                        ? styles.reqValid
                        : styles.reqInvalid
                    }
                  >
                    8 characters long
                  </Text>
                  <Text style={styles.requirementsMuted}>
                    , and include a mix of{" "}
                  </Text>
                  <Text
                    style={
                      passwordValidation.hasLowercase
                        ? styles.reqValid
                        : styles.reqInvalid
                    }
                  >
                    lowercase
                  </Text>
                  <Text style={styles.requirementsMuted}> and </Text>
                  <Text
                    style={
                      passwordValidation.hasUppercase
                        ? styles.reqValid
                        : styles.reqInvalid
                    }
                  >
                    uppercase letters
                  </Text>
                  <Text style={styles.requirementsMuted}>, </Text>
                  <Text
                    style={
                      passwordValidation.hasNumber
                        ? styles.reqValid
                        : styles.reqInvalid
                    }
                  >
                    numbers
                  </Text>
                  <Text style={styles.requirementsMuted}>, and </Text>
                  <Text
                    style={
                      passwordValidation.hasSymbol
                        ? styles.reqValid
                        : styles.reqInvalid
                    }
                  >
                    symbols
                  </Text>
                </Text>
              )}
            </View>

            <Pressable
              style={[
                styles.button,
                (loading || !isPasswordValid) && styles.buttonDisabled,
              ]}
              onPress={handlePasswordSubmit}
              disabled={loading || !isPasswordValid}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Complete Sign Up</Text>
              )}
            </Pressable>

            <View style={styles.toggleContainer}>
              <Text style={styles.toggleText}>Already have an account? </Text>
              <Pressable onPress={toggleFlow} disabled={loading}>
                <Text style={styles.toggleLink}>Sign in</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Step 1: Profile (First Name, Last Name, Email)
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Create an Ourin account</Text>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.nameRow}>
            <View style={styles.nameField}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your first name"
                placeholderTextColor="#666"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                autoComplete="given-name"
                editable={!loading}
              />
            </View>
            <View style={styles.nameField}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your last name"
                placeholderTextColor="#666"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                autoComplete="family-name"
                editable={!loading}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email address</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email address"
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

          <Pressable
            style={[
              styles.button,
              (loading || !firstName || !lastName || !email) &&
                styles.buttonDisabled,
            ]}
            onPress={handleProfileContinue}
            disabled={loading || !firstName || !lastName || !email}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </Pressable>

          <View style={styles.toggleContainer}>
            <Text style={styles.toggleText}>Already have an account? </Text>
            <Pressable onPress={toggleFlow} disabled={loading}>
              <Text style={styles.toggleLink}>Sign in</Text>
            </Pressable>
          </View>
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  backText: {
    fontSize: 24,
    color: "#a3a3a3",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
    color: "#f5f5f4",
  },
  titleSmall: {
    fontSize: 22,
    fontWeight: "700",
    color: "#f5f5f4",
  },
  subtitle: {
    fontSize: 16,
    color: "#a3a3a3",
    marginBottom: 32,
    lineHeight: 24,
  },
  emailHighlight: {
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
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  successContainer: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
  },
  messageText: {
    fontSize: 14,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 14,
  },
  successText: {
    color: "#22c55e",
  },
  nameRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  nameField: {
    flex: 1,
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
  requirementsContainer: {
    marginBottom: 20,
  },
  requirementsMuted: {
    color: "#666",
    fontSize: 12,
    lineHeight: 18,
  },
  requirementsText: {
    fontSize: 12,
    lineHeight: 18,
  },
  reqValid: {
    color: "#22c55e",
  },
  reqInvalid: {
    color: "#ef4444",
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
  linkDisabled: {
    opacity: 0.5,
  },
});
