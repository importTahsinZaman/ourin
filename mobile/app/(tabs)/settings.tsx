import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Text style={styles.hint}>Sign in to sync your conversations</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Model</Text>
          <Text style={styles.hint}>Select your preferred AI model</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Billing</Text>
          <Text style={styles.hint}>Manage your subscription and credits</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  hint: {
    fontSize: 14,
    color: "#666",
  },
});
