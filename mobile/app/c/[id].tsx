import { useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { FREE_MODEL_ID } from "@ourin/shared/models";
import type { UIMessage, MessagePart } from "@ourin/shared/types";
import { useOurinChat } from "@/hooks/useOurinChat";
import { MessageList, ChatInput } from "@/components/chat";
import { Ionicons } from "@expo/vector-icons";

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // Load conversation details
  const conversation = useQuery(
    api.conversations.get,
    id ? { id: id as Id<"conversations"> } : "skip"
  );

  // Load messages for this conversation
  const messagesData = useQuery(
    api.messages.getByConversation,
    id ? { conversationId: id as Id<"conversations"> } : "skip"
  );

  // Transform DB messages to UIMessage format
  const initialMessages: UIMessage[] = (messagesData ?? []).map((msg) => ({
    id: msg.id,
    role: msg.role as "user" | "assistant" | "system",
    parts: msg.parts as MessagePart[],
    model: msg.model,
    createdAt: msg.createdAt ? new Date(msg.createdAt) : undefined,
    metadata: msg.metadata as UIMessage["metadata"],
  }));

  const { messages, status, sendMessage, stop, setMessages } = useOurinChat({
    conversationId: id ?? null,
    initialMessages: [],
    model: conversation?.model ?? FREE_MODEL_ID,
  });

  // Sync initial messages when they load
  useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages.length, messages.length, setMessages]);

  const handleSend = useCallback(
    (text: string) => {
      sendMessage(text);
    },
    [sendMessage]
  );

  const isStreaming = status === "streaming" || status === "submitted";
  const isLoading = messagesData === undefined;

  // Use local messages if we have them, otherwise use initial messages
  const displayMessages = messages.length > 0 ? messages : initialMessages;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: "#1a1a1a" },
          headerTintColor: "#f5f5f4",
          headerTitle: conversation?.title ?? "Chat",
          headerTitleStyle: { fontSize: 16 },
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              style={{ marginRight: 16 }}
            >
              <Ionicons name="arrow-back" size={24} color="#f5f5f4" />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View style={{ flex: 1 }}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#d97756" />
            </View>
          ) : displayMessages.length > 0 ? (
            <MessageList messages={displayMessages} isStreaming={isStreaming} />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No messages yet</Text>
            </View>
          )}

          <ChatInput
            onSend={handleSend}
            onStop={stop}
            isStreaming={isStreaming}
            placeholder="Continue the conversation..."
          />
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 160, // Space for floating input
  },
  emptyText: {
    color: "#666",
    fontSize: 16,
  },
});
