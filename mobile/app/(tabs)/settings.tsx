import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks";

export default function SettingsScreen() {
  const { user, isAnonymous } = useAuth();

  const handleSignIn = () => {
    router.push("/(auth)/login");
  };

  const handleSignOut = () => {
    // TODO: implement sign out
    console.log("Sign out");
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Account Section */}
      <View style={styles.section}>
        {isAnonymous ? (
          <>
            <Text style={styles.sectionLabel}>Anonymous User</Text>
            <Pressable style={styles.signInButton} onPress={handleSignIn}>
              <Text style={styles.signInText}>
                Sign in to sync conversations
              </Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.emailContainer}>
              <Text style={styles.email}>{user?.email}</Text>
            </View>
            <SettingsRow label="Profile" onPress={() => {}} />
            <SettingsRow label="Billing" value="Free" onPress={() => {}} />
          </>
        )}
      </View>

      {/* Preferences Section */}
      <View style={styles.section}>
        <SettingsRow label="Appearance" value="System" onPress={() => {}} />
        <SettingsRow label="Default Model" value="GPT-4o" onPress={() => {}} />
      </View>

      {/* Features Section */}
      <View style={styles.section}>
        <SettingsRow label="Cores" onPress={() => {}} />
        <SettingsRow label="API Keys" onPress={() => {}} />
      </View>

      {/* App Section */}
      <View style={styles.section}>
        <View style={styles.toggleRow}>
          <Text style={styles.rowLabel}>Haptic Feedback</Text>
          <Switch
            value={true}
            onValueChange={() => {}}
            trackColor={{ false: "#404040", true: "#d97756" }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Sign Out */}
      {!isAnonymous && (
        <View style={styles.section}>
          <Pressable style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>
      )}

      {/* Version */}
      <Text style={styles.version}>Version 1.0.0</Text>
    </ScrollView>
  );
}

function SettingsRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value?: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value && <Text style={styles.rowValue}>{value}</Text>}
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: "#262626",
    borderRadius: 12,
    marginBottom: 20,
    overflow: "hidden",
  },
  sectionLabel: {
    fontSize: 12,
    color: "#666",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  emailContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  email: {
    fontSize: 16,
    color: "#f5f5f4",
  },
  signInButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  signInText: {
    fontSize: 16,
    color: "#d97756",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  rowLabel: {
    fontSize: 16,
    color: "#f5f5f4",
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowValue: {
    fontSize: 16,
    color: "#666",
  },
  chevron: {
    fontSize: 20,
    color: "#666",
  },
  signOutButton: {
    padding: 16,
    alignItems: "center",
  },
  signOutText: {
    fontSize: 16,
    color: "#ef4444",
  },
  version: {
    textAlign: "center",
    fontSize: 12,
    color: "#666",
    marginTop: 8,
  },
});
