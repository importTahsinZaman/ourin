import React, { useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, type DerivedColors } from "@/providers/ThemeProvider";
import {
  MODELS_BY_DATE,
  FREE_MODEL_ID,
  type Model,
} from "@ourin/shared/models";

interface ModelPickerModalProps {
  visible: boolean;
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  onClose: () => void;
}

export function ModelPickerModal({
  visible,
  selectedModel,
  onSelectModel,
  onClose,
}: ModelPickerModalProps) {
  const { colors } = useTheme();

  // Group models by provider
  const modelsByProvider = useMemo(() => {
    const groups: Record<string, Model[]> = {
      google: [],
      anthropic: [],
      openai: [],
    };
    MODELS_BY_DATE.forEach((model) => {
      groups[model.provider].push(model);
    });
    return groups;
  }, []);

  const providerNames: Record<string, string> = {
    google: "Google",
    anthropic: "Anthropic",
    openai: "OpenAI",
  };

  const providerOrder = ["anthropic", "google", "openai"];

  const handleSelect = (modelId: string) => {
    onSelectModel(modelId);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "600", color: colors.text }}>
            Select Model
          </Text>
          <Pressable onPress={onClose} style={{ padding: 4 }}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </Pressable>
        </View>
        <ScrollView
          style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {providerOrder.map((provider) => (
            <View key={provider} style={{ marginBottom: 20 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: colors.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  marginBottom: 8,
                  paddingLeft: 4,
                }}
              >
                {providerNames[provider]}
              </Text>
              {modelsByProvider[provider].map((model) => (
                <ModelRow
                  key={model.id}
                  model={model}
                  isSelected={selectedModel === model.id}
                  isFree={model.id === FREE_MODEL_ID}
                  onPress={() => handleSelect(model.id)}
                  colors={colors}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

interface ModelRowProps {
  model: Model;
  isSelected: boolean;
  isFree: boolean;
  onPress: () => void;
  colors: DerivedColors;
}

function ModelRow({
  model,
  isSelected,
  isFree,
  onPress,
  colors,
}: ModelRowProps) {
  const hasReasoning = !!model.reasoningParameter;

  return (
    <Pressable
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 10,
        marginBottom: 4,
        backgroundColor: isSelected
          ? colors.backgroundSecondary
          : "transparent",
      }}
      onPress={onPress}
    >
      <View style={{ flex: 1, marginRight: 12 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 2,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: "500", color: colors.text }}>
            {model.name}
          </Text>
          {hasReasoning && (
            <Ionicons
              name="bulb-outline"
              size={14}
              color={colors.accent}
              style={{ marginLeft: 6 }}
            />
          )}
          {isFree && (
            <View
              style={{
                backgroundColor: colors.success,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
                marginLeft: 8,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}>
                FREE
              </Text>
            </View>
          )}
        </View>
        <Text
          style={{ fontSize: 13, color: colors.textMuted }}
          numberOfLines={1}
        >
          {model.description}
        </Text>
      </View>
      {isSelected && (
        <Ionicons name="checkmark" size={20} color={colors.accent} />
      )}
    </Pressable>
  );
}
