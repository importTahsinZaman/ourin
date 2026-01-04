import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  FREE_MODEL_ID,
  MODELS_BY_DATE,
  getModelInfo,
  canDisableReasoning,
} from "@ourin/shared/models";
import type { UIMessage, MessagePart, FilePart } from "@ourin/shared/types";
import { useOurinChat } from "@/hooks/useOurinChat";
import { useCores } from "@/hooks/useCores";
import { useTheme } from "@/providers/ThemeProvider";
import { MessageList, ChatInput } from "@/components/chat";
import { ModelPickerModal } from "@/components/ModelPickerModal";
import { CorePickerModal } from "@/components/CorePickerModal";
import { ReasoningPickerModal } from "@/components/ReasoningPickerModal";
import { Sidebar } from "@/components/Sidebar";

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { conversationId: paramConversationId } = useLocalSearchParams<{
    conversationId?: string;
  }>();

  const [conversationId, setConversationId] = useState<string | null>(
    paramConversationId ?? null
  );
  const [selectedModel, setSelectedModel] = useState(FREE_MODEL_ID);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  // Load conversation details if we have an ID
  const conversation = useQuery(
    api.conversations.get,
    conversationId ? { id: conversationId as Id<"conversations"> } : "skip"
  );

  // Load messages for the conversation
  const messagesData = useQuery(
    api.messages.getByConversation,
    conversationId
      ? { conversationId: conversationId as Id<"conversations"> }
      : "skip"
  );

  // Web search and reasoning state
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [reasoningLevel, setReasoningLevel] = useState<string | number>(
    "medium"
  );

  // Update model when conversation loads
  useEffect(() => {
    if (conversation?.model) {
      setSelectedModel(conversation.model);
    }
  }, [conversation?.model]);

  // Modal visibility states
  const [modelPickerVisible, setModelPickerVisible] = useState(false);
  const [corePickerVisible, setCorePickerVisible] = useState(false);
  const [reasoningPickerVisible, setReasoningPickerVisible] = useState(false);

  // Model capabilities
  const modelInfo = useMemo(() => getModelInfo(selectedModel), [selectedModel]);
  const modelSupportsWebSearch = modelInfo.supportsWebSearch;
  const modelSupportsReasoning = !!modelInfo.reasoningParameter;

  // Get the default reasoning level when model changes
  useEffect(() => {
    if (modelInfo.reasoningParameter?.defaultValue !== undefined) {
      setReasoningLevel(modelInfo.reasoningParameter.defaultValue);
    } else if (modelSupportsReasoning && canDisableReasoning(selectedModel)) {
      setReasoningLevel("off");
    }
  }, [selectedModel, modelInfo, modelSupportsReasoning]);

  // Get reasoning label for display
  const reasoningLabel = useMemo(() => {
    if (!modelSupportsReasoning) return undefined;
    if (reasoningLevel === "off") return "Off";

    const { kind, presets, allowedValues } = modelInfo.reasoningParameter!;
    if (kind === "effort" && allowedValues) {
      const value = reasoningLevel as string;
      return value.charAt(0).toUpperCase() + value.slice(1);
    }
    if (kind === "budget" && presets) {
      const preset = presets.find((p) => p.value === reasoningLevel);
      return preset?.label;
    }
    return undefined;
  }, [modelSupportsReasoning, reasoningLevel, modelInfo]);

  const {
    cores,
    activeCoresCount,
    getActivePrompt,
    getActiveCoreNames,
    toggleActive,
  } = useCores();

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
    conversationId,
    model: selectedModel,
    reasoningLevel:
      modelSupportsReasoning && reasoningLevel !== "off"
        ? reasoningLevel
        : undefined,
    getActivePrompt,
    getActiveCoreNames,
    onConversationCreate: (id) => {
      setConversationId(id);
    },
  });

  // Update conversationId when URL param changes (navigating from history)
  const prevParamRef = useRef(paramConversationId);
  useEffect(() => {
    if (paramConversationId !== prevParamRef.current) {
      setMessages([]);
      setConversationId(paramConversationId ?? null);
      prevParamRef.current = paramConversationId;
    }
  }, [paramConversationId, setMessages]);

  // Sync initial messages when loading an existing conversation
  useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages.length, messages.length, setMessages]);

  const handleSend = useCallback(
    (
      text: string,
      files?: FilePart[],
      options?: { webSearchEnabled?: boolean }
    ) => {
      const sendOptions = options?.webSearchEnabled
        ? { webSearchEnabled: true }
        : undefined;

      if (files && files.length > 0) {
        const parts: MessagePart[] = [];
        if (text) {
          parts.push({ type: "text", text });
        }
        parts.push(...files);
        sendMessage({ role: "user", parts }, sendOptions);
      } else {
        sendMessage(text, sendOptions);
      }
    },
    [sendMessage]
  );

  const handleSelectModel = useCallback((modelId: string) => {
    setSelectedModel(modelId);
  }, []);

  const handleNewChat = useCallback(() => {
    router.replace("/(tabs)");
    setConversationId(null);
    setMessages([]);
    setSelectedModel(FREE_MODEL_ID);
  }, [router, setMessages]);

  const selectedModelName =
    MODELS_BY_DATE.find((m) => m.id === selectedModel)?.name || "Model";

  const isStreaming = status === "streaming" || status === "submitted";

  const displayMessages = messages.length > 0 ? messages : initialMessages;
  const hasMessages = displayMessages.length > 0;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    return "evening";
  };

  return (
    <Sidebar
      visible={sidebarVisible}
      onClose={() => setSidebarVisible(false)}
      currentConversationId={conversationId}
      onNewChat={handleNewChat}
    >
      <View
        style={{
          flex: 1,
          paddingTop: insets.top,
        }}
      >
        {/* Custom Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 8,
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Pressable
            style={{
              width: 44,
              height: 44,
              justifyContent: "center",
              alignItems: "center",
            }}
            onPress={() => setSidebarVisible(true)}
          >
            <Ionicons name="menu-outline" size={26} color={colors.text} />
          </Pressable>

          {/* Model Picker - Center */}
          <Pressable
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
            onPress={() => setModelPickerVisible(true)}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: "500",
                color: colors.text,
                maxWidth: 160,
              }}
              numberOfLines={1}
            >
              {selectedModelName}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </Pressable>

          <Pressable
            style={{
              width: 44,
              height: 44,
              justifyContent: "center",
              alignItems: "center",
            }}
            onPress={handleNewChat}
            disabled={isStreaming}
          >
            <Ionicons
              name="create-outline"
              size={24}
              color={isStreaming ? colors.textMuted : colors.text}
            />
          </Pressable>
        </View>

        {/* Main Content */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          {hasMessages ? (
            <MessageList messages={displayMessages} isStreaming={isStreaming} />
          ) : (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                paddingHorizontal: 40,
                paddingBottom: 160, // Space for floating input
              }}
            >
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: "500",
                  color: colors.textSecondary,
                  textAlign: "center",
                  lineHeight: 38,
                }}
              >
                How can I help you{"\n"}this {getGreeting()}?
              </Text>
            </View>
          )}

          <ChatInput
            onSend={handleSend}
            onStop={stop}
            isStreaming={isStreaming}
            placeholder="Chat with Ourin"
            activeCoresCount={activeCoresCount}
            onOpenCorePicker={() => setCorePickerVisible(true)}
            webSearchEnabled={webSearchEnabled}
            onWebSearchToggle={setWebSearchEnabled}
            modelSupportsWebSearch={modelSupportsWebSearch}
            reasoningLevel={reasoningLevel}
            onOpenReasoningPicker={() => setReasoningPickerVisible(true)}
            modelSupportsReasoning={modelSupportsReasoning}
            reasoningLabel={reasoningLabel}
          />
        </KeyboardAvoidingView>

        {/* Modals */}
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

        <ReasoningPickerModal
          visible={reasoningPickerVisible}
          selectedModel={selectedModel}
          reasoningLevel={reasoningLevel}
          onSelectReasoningLevel={setReasoningLevel}
          onClose={() => setReasoningPickerVisible(false)}
        />
      </View>
    </Sidebar>
  );
}
