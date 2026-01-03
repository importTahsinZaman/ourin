import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { FREE_MODEL_ID } from "@ourin/shared/models";
import { useOurinChat } from "@/hooks/useOurinChat";
import { MessageList, ChatInput } from "@/components/chat";

export default function ChatScreen() {
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(null);

  const { messages, status, sendMessage, stop } = useOurinChat({
    conversationId,
    model: FREE_MODEL_ID,
    onConversationCreate: (id) => {
      // Just update the conversation ID, don't navigate
      // This keeps the streaming alive on this screen
      setConversationId(id);
    },
  });

  const handleSend = useCallback(
    (text: string) => {
      sendMessage(text);
    },
    [sendMessage]
  );

  const isStreaming = status === "streaming" || status === "submitted";
  const hasMessages = messages.length > 0;

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    return "evening";
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {hasMessages ? (
        <MessageList messages={messages} isStreaming={isStreaming} />
      ) : (
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeEmoji}>✨</Text>
          <Text style={styles.welcomeText}>
            How can I help you{"\n"}this {getGreeting()}?
          </Text>
        </View>
      )}

      <ChatInput
        onSend={handleSend}
        onStop={stop}
        isStreaming={isStreaming}
        placeholder="Chat with Ourin"
      />
    </KeyboardAvoidingView>
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
});
