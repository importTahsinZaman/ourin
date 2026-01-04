import React from "react";
import { View, Text, Modal, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/providers/ThemeProvider";
import {
  getModelInfo,
  canDisableReasoning,
  type ReasoningPreset,
} from "@ourin/shared/models";

interface ReasoningPickerModalProps {
  visible: boolean;
  selectedModel: string;
  reasoningLevel: string | number;
  onSelectReasoningLevel: (level: string | number) => void;
  onClose: () => void;
}

export function ReasoningPickerModal({
  visible,
  selectedModel,
  reasoningLevel,
  onSelectReasoningLevel,
  onClose,
}: ReasoningPickerModalProps) {
  const { colors } = useTheme();
  const modelInfo = getModelInfo(selectedModel);

  // Don't render if model doesn't support reasoning
  if (!modelInfo.reasoningParameter) {
    return null;
  }

  const { kind, allowedValues, presets } = modelInfo.reasoningParameter;
  const allowOff = canDisableReasoning(selectedModel);
  const isOff = reasoningLevel === "off";

  // Get display options based on kind
  const options: Array<{
    key: string;
    label: string;
    value: string | number;
    description?: string;
  }> =
    kind === "effort" && allowedValues
      ? allowedValues.map((v) => ({
          key: v,
          label: v.charAt(0).toUpperCase() + v.slice(1),
          value: v,
          description: getEffortDescription(v),
        }))
      : (presets?.map((p: ReasoningPreset) => ({
          key: p.key,
          label: p.label,
          value: p.value,
          description: getBudgetDescription(p.value as number),
        })) ?? []);

  const handleSelect = (value: string | number) => {
    onSelectReasoningLevel(value);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: "600", color: colors.text }}>
            {kind === "effort" ? "Reasoning Effort" : "Thinking Budget"}
          </Text>
          <Pressable style={{ padding: 4 }} onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Description */}
        <Text
          style={{
            fontSize: 14,
            color: colors.textMuted,
            paddingHorizontal: 20,
            paddingVertical: 16,
            lineHeight: 20,
          }}
        >
          {kind === "effort"
            ? "Control how much effort the model puts into reasoning through problems."
            : "Set how many tokens the model can use for internal reasoning."}
        </Text>

        {/* Options */}
        <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
          {/* Off option - only for models that allow disabling */}
          {allowOff && (
            <Pressable
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 16,
                paddingHorizontal: 16,
                marginBottom: 8,
                backgroundColor: colors.backgroundSecondary,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: isOff ? colors.accent : "transparent",
              }}
              onPress={() => handleSelect("off")}
            >
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "500",
                    color: isOff ? colors.accent : colors.text,
                  }}
                >
                  Off
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.textMuted,
                    marginTop: 4,
                  }}
                >
                  Disable extended reasoning
                </Text>
              </View>
              {isOff && (
                <Ionicons name="checkmark" size={22} color={colors.accent} />
              )}
            </Pressable>
          )}

          {options.map((option) => {
            const isSelected = option.value === reasoningLevel;
            return (
              <Pressable
                key={option.key}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 16,
                  paddingHorizontal: 16,
                  marginBottom: 8,
                  backgroundColor: colors.backgroundSecondary,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: isSelected ? colors.accent : "transparent",
                }}
                onPress={() => handleSelect(option.value)}
              >
                <View style={{ flex: 1, marginRight: 12 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "500",
                        color: isSelected ? colors.accent : colors.text,
                      }}
                    >
                      {option.label}
                    </Text>
                    {kind === "budget" && typeof option.value === "number" && (
                      <Text
                        style={{ fontSize: 12, color: colors.textTertiary }}
                      >
                        {(option.value / 1000).toFixed(0)}k tokens
                      </Text>
                    )}
                  </View>
                  {option.description && (
                    <Text
                      style={{
                        fontSize: 13,
                        color: colors.textMuted,
                        marginTop: 4,
                      }}
                    >
                      {option.description}
                    </Text>
                  )}
                </View>
                {isSelected && (
                  <Ionicons name="checkmark" size={22} color={colors.accent} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

function getEffortDescription(effort: string): string {
  switch (effort) {
    case "low":
      return "Quick responses with minimal reasoning";
    case "medium":
      return "Balanced reasoning and response time";
    case "high":
      return "Deep reasoning for complex problems";
    default:
      return "";
  }
}

function getBudgetDescription(tokens: number): string {
  if (tokens <= 4000) return "Quick responses, minimal thinking";
  if (tokens <= 8000) return "Balanced reasoning";
  if (tokens <= 16000) return "Extended reasoning for complex tasks";
  return "Maximum reasoning depth";
}
