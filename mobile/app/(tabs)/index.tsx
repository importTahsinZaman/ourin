import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FREE_MODEL_ID, getModelInfo } from "@ourin/shared/models";

export default function ChatScreen() {
  const defaultModel = getModelInfo(FREE_MODEL_ID);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to Ourin</Text>
        <Text style={styles.subtitle}>
          Start a conversation with {defaultModel.name}
        </Text>
        <Text style={styles.hint}>Chat input coming soon...</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 20,
  },
  hint: {
    fontSize: 14,
    color: "#999",
  },
});
