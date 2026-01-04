import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAuth } from "@/hooks";
import { useTheme } from "@/providers/ThemeProvider";
import { ThemePickerModal } from "@/components/ThemePickerModal";
import { FontPickerModal } from "@/components/FontPickerModal";
import { UsageCard } from "@/components/settings/UsageCard";

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { signOut } = useAuthActions();
  const { theme, currentFont } = useTheme();

  const [themePickerVisible, setThemePickerVisible] = useState(false);
  const [fontPickerVisible, setFontPickerVisible] = useState(false);

  const handleSignOut = async () => {
    await signOut();
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={24} color="#f5f5f4" />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Section */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.section}>
          <View style={styles.emailRow}>
            <Ionicons name="person-circle-outline" size={24} color="#9ca3af" />
            <Text style={styles.email}>{user?.email || "Not signed in"}</Text>
          </View>
          <Pressable style={styles.signOutRow} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>

        {/* Usage Section */}
        <Text style={styles.sectionTitle}>Usage</Text>
        <UsageCard accentColor={theme.colors.accent} />

        {/* Appearance Section */}
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.section}>
          <SettingsRow
            label="Theme"
            value={theme.name}
            onPress={() => setThemePickerVisible(true)}
          />
          <SettingsRow
            label="Font"
            value={currentFont.name}
            onPress={() => setFontPickerVisible(true)}
            isLast
          />
        </View>

        {/* App Section */}
        <Text style={styles.sectionTitle}>App</Text>
        <View style={styles.section}>
          <View style={styles.infoRow}>
            <Text style={styles.rowLabel}>Version</Text>
            <Text style={styles.rowValue}>1.0.0</Text>
          </View>
        </View>
      </ScrollView>

      {/* Modals */}
      <ThemePickerModal
        visible={themePickerVisible}
        onClose={() => setThemePickerVisible(false)}
      />
      <FontPickerModal
        visible={fontPickerVisible}
        onClose={() => setFontPickerVisible(false)}
      />
    </View>
  );
}

function SettingsRow({
  label,
  value,
  onPress,
  isLast = false,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      style={[styles.row, !isLast && styles.rowBorder]}
      onPress={onPress}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value && <Text style={styles.rowValue}>{value}</Text>}
        <Ionicons name="chevron-forward" size={18} color="#666" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#f5f5f4",
  },
  headerSpacer: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
    paddingLeft: 4,
  },
  section: {
    backgroundColor: "#262626",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  email: {
    fontSize: 16,
    color: "#f5f5f4",
  },
  signOutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  signOutText: {
    fontSize: 16,
    color: "#ef4444",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  infoRow: {
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
    gap: 6,
  },
  rowValue: {
    fontSize: 16,
    color: "#9ca3af",
  },
});
