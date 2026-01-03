import React from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {kind === "effort" ? "Reasoning Effort" : "Thinking Budget"}
          </Text>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#9ca3af" />
          </Pressable>
        </View>

        {/* Description */}
        <Text style={styles.description}>
          {kind === "effort"
            ? "Control how much effort the model puts into reasoning through problems."
            : "Set how many tokens the model can use for internal reasoning."}
        </Text>

        {/* Options */}
        <ScrollView style={styles.optionsList}>
          {/* Off option - only for models that allow disabling */}
          {allowOff && (
            <Pressable
              style={[styles.optionItem, isOff && styles.optionItemSelected]}
              onPress={() => handleSelect("off")}
            >
              <View style={styles.optionContent}>
                <Text
                  style={[
                    styles.optionLabel,
                    isOff && styles.optionLabelSelected,
                  ]}
                >
                  Off
                </Text>
                <Text style={styles.optionDescription}>
                  Disable extended reasoning
                </Text>
              </View>
              {isOff && <Ionicons name="checkmark" size={22} color="#d97756" />}
            </Pressable>
          )}

          {options.map((option) => {
            const isSelected = option.value === reasoningLevel;
            return (
              <Pressable
                key={option.key}
                style={[
                  styles.optionItem,
                  isSelected && styles.optionItemSelected,
                ]}
                onPress={() => handleSelect(option.value)}
              >
                <View style={styles.optionContent}>
                  <View style={styles.optionLabelRow}>
                    <Text
                      style={[
                        styles.optionLabel,
                        isSelected && styles.optionLabelSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {kind === "budget" && typeof option.value === "number" && (
                      <Text style={styles.optionBudget}>
                        {(option.value / 1000).toFixed(0)}k tokens
                      </Text>
                    )}
                  </View>
                  {option.description && (
                    <Text style={styles.optionDescription}>
                      {option.description}
                    </Text>
                  )}
                </View>
                {isSelected && (
                  <Ionicons name="checkmark" size={22} color="#d97756" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#f5f5f4",
  },
  closeButton: {
    padding: 4,
  },
  description: {
    fontSize: 14,
    color: "#9ca3af",
    paddingHorizontal: 20,
    paddingVertical: 16,
    lineHeight: 20,
  },
  optionsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#262626",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  optionItemSelected: {
    borderColor: "#d97756",
    backgroundColor: "rgba(217, 119, 86, 0.1)",
  },
  optionContent: {
    flex: 1,
    marginRight: 12,
  },
  optionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#f5f5f4",
  },
  optionLabelSelected: {
    color: "#d97756",
  },
  optionBudget: {
    fontSize: 12,
    color: "#6b7280",
  },
  optionDescription: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 4,
  },
});
