import { View, Text, StyleSheet, TextInput, Pressable } from "react-native";
import { FREE_MODEL_ID, getModelInfo } from "@ourin/shared/models";

export default function ChatScreen() {
  const defaultModel = getModelInfo(FREE_MODEL_ID);

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    return "evening";
  };

  return (
    <View style={styles.container}>
      {/* Empty State / Welcome */}
      <View style={styles.welcomeContainer}>
        <Text style={styles.welcomeEmoji}>✨</Text>
        <Text style={styles.welcomeText}>
          How can I help you{"\n"}this {getGreeting()}?
        </Text>
      </View>

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Chat with Ourin"
            placeholderTextColor="#666"
            multiline
          />
          <View style={styles.inputButtons}>
            <Pressable style={styles.iconButton}>
              <Text style={styles.iconText}>+</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  welcomeEmoji: {
    fontSize: 32,
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: "500",
    color: "#d4c4b0",
    textAlign: "center",
    lineHeight: 38,
  },
  inputContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  inputWrapper: {
    backgroundColor: "#262626",
    borderRadius: 24,
    padding: 12,
    minHeight: 56,
  },
  input: {
    fontSize: 16,
    color: "#f5f5f4",
    paddingHorizontal: 8,
    maxHeight: 120,
  },
  inputButtons: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginTop: 8,
    gap: 8,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#404040",
    justifyContent: "center",
    alignItems: "center",
  },
  iconText: {
    color: "#a3a3a3",
    fontSize: 20,
    fontWeight: "300",
  },
});
