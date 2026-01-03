import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { FREE_MODEL_ID, MODELS_BY_DATE } from "@ourin/shared/models";
import { useOurinChat } from "@/hooks/useOurinChat";
import { useCores } from "@/hooks/useCores";
import { MessageList, ChatInput } from "@/components/chat";
import { ModelPickerModal } from "@/components/ModelPickerModal";
import { CorePickerModal } from "@/components/CorePickerModal";

export default function ChatScreen() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(FREE_MODEL_ID);
  const [modelPickerVisible, setModelPickerVisible] = useState(false);
  const [corePickerVisible, setCorePickerVisible] = useState(false);

  const {
    cores,
    activeCoresCount,
    getActivePrompt,
    getActiveCoreNames,
    toggleActive,
  } = useCores();

  const { messages, status, sendMessage, stop } = useOurinChat({
    conversationId,
    model: selectedModel,
    getActivePrompt,
    getActiveCoreNames,
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

  const handleSelectModel = useCallback((modelId: string) => {
    setSelectedModel(modelId);
  }, []);

  const selectedModelName =
    MODELS_BY_DATE.find((m) => m.id === selectedModel)?.name || "Model";

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
        modelName={selectedModelName}
        activeCoresCount={activeCoresCount}
        onOpenModelPicker={() => setModelPickerVisible(true)}
        onOpenCorePicker={() => setCorePickerVisible(true)}
      />

      <ModelPickerModal
        visible={modelPickerVisible}
        selectedModel={selectedModel}
        onSelectModel={handleSelectModel}
        onClose={() => setModelPickerVisible(false)}
      />

      <CorePickerModal
        visible={corePickerVisible}
        cores={cores}
        activeCoresCount={activeCoresCount}
        onToggleCore={toggleActive}
        onClose={() => setCorePickerVisible(false)}
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
