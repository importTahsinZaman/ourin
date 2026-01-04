import React, { useState, useMemo } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { DerivedColors } from "@/providers/ThemeProvider";
import type { MessagePart, ToolInvocationPart } from "@ourin/shared/types";
import { StepsModal, buildStepsFromParts } from "./StepsModal";

interface StepsAccordionProps {
  parts: MessagePart[];
  isStreaming?: boolean;
  isActivelyThinking?: boolean;
  colors: DerivedColors;
}

// Get preview text for the last step
function getLastStepPreview(parts: MessagePart[]): string {
  // Find the last reasoning or search step
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (part.type === "reasoning" && part.text.trim()) {
      return part.text.slice(0, 50) + (part.text.length > 50 ? "..." : "");
    }
    if (part.type === "tool-invocation") {
      const toolPart = part as ToolInvocationPart;
      if (toolPart.toolName.toLowerCase().includes("search")) {
        const args = toolPart.args as { query?: string } | undefined;
        if (args?.query) {
          return args.query;
        }
        return "Web search";
      }
    }
  }
  return "";
}

export function StepsAccordion({
  parts,
  isStreaming,
  isActivelyThinking,
  colors,
}: StepsAccordionProps) {
  const [modalVisible, setModalVisible] = useState(false);

  // Build steps from parts
  const steps = useMemo(
    () => buildStepsFromParts(parts, isStreaming, isActivelyThinking),
    [parts, isStreaming, isActivelyThinking]
  );

  // Don't render if no steps
  if (steps.length === 0) return null;

  // Check if any step is actively loading
  const isLoading = steps.some(
    (step) =>
      (step.type === "reasoning" && step.isThinking) ||
      (step.type === "search" && step.data.state !== "result")
  );

  // Get preview text
  const preview = getLastStepPreview(parts);

  return (
    <>
      <Pressable
        onPress={() => setModalVisible(true)}
        style={{
          backgroundColor: colors.backgroundSecondary,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 14,
          marginBottom: 12,
        }}
      >
        {/* Header row */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 20, alignItems: "center" }}>
              <Ionicons name="chevron-up" size={18} color={colors.textMuted} />
            </View>
            <Text
              style={{ color: colors.textMuted, fontSize: 16, marginLeft: 10 }}
            >
              {steps.length} step{steps.length !== 1 ? "s" : ""}
            </Text>
          </View>
          {isLoading && (
            <ActivityIndicator size="small" color={colors.textMuted} />
          )}
        </View>

        {/* Preview of last step */}
        {preview && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 16,
            }}
          >
            <View style={{ width: 20, alignItems: "center" }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.textMuted,
                }}
              />
            </View>
            <Text
              style={{
                flex: 1,
                color: colors.textSecondary,
                fontSize: 16,
                lineHeight: 22,
                marginLeft: 10,
              }}
              numberOfLines={1}
            >
              {preview}
            </Text>
          </View>
        )}
      </Pressable>

      <StepsModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        steps={steps}
        colors={colors}
      />
    </>
  );
}
