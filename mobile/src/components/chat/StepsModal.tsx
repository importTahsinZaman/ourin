import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  Image,
  Linking,
  ActivityIndicator,
  Dimensions,
  TouchableWithoutFeedback,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Markdown from "react-native-markdown-display";
import type { DerivedColors } from "@/providers/ThemeProvider";
import type {
  MessagePart,
  ReasoningPart,
  ToolInvocationPart,
} from "@ourin/shared/types";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.55; // 55% of screen height

// Step item type for internal use
type StepItem =
  | { type: "search"; data: ToolInvocationPart; id: string }
  | {
      type: "reasoning";
      text: string;
      isThinking: boolean;
      duration?: number;
      id: string;
    };

interface StepsModalProps {
  visible: boolean;
  onClose: () => void;
  steps: StepItem[];
  colors: DerivedColors;
}

// Extract search data from tool invocation
function extractSearchData(part: ToolInvocationPart): {
  query: string | undefined;
  results: Array<{ url: string; title: string; domain: string }>;
  isSearching: boolean;
} {
  const args = part.args as { query?: string } | undefined;
  const isSearching = part.state !== "result";
  const query = args?.query;

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  const mapResults = (
    arr: Array<{ url?: string; title?: string; type?: string }>
  ) =>
    arr
      .filter((r) => r.url && r.title)
      .map((r) => ({
        url: r.url!,
        title: r.title!,
        domain: getDomain(r.url!),
      }));

  // Handle different API formats
  if (Array.isArray(part.result)) {
    return { query, results: mapResults(part.result), isSearching };
  }

  const anthropicResult = part.result as
    | { content?: Array<{ url?: string; title?: string }> }
    | undefined;
  if (anthropicResult?.content && Array.isArray(anthropicResult.content)) {
    return { query, results: mapResults(anthropicResult.content), isSearching };
  }

  const openaiResult = part.result as
    | {
        action?: { query?: string };
        results?: Array<{ url?: string; title?: string }>;
      }
    | undefined;
  if (openaiResult?.action?.query || openaiResult?.results) {
    const openaiQuery = openaiResult.action?.query || query;
    return {
      query: openaiQuery,
      results: mapResults(openaiResult.results || []),
      isSearching,
    };
  }

  return { query, results: [], isSearching };
}

// Get step label for the list
function getStepLabel(step: StepItem): string {
  if (step.type === "reasoning") {
    if (step.isThinking) return "Thinking...";
    return step.text.slice(0, 80) + (step.text.length > 80 ? "..." : "");
  } else {
    const { query, isSearching } = extractSearchData(step.data);
    if (isSearching) return "Searching...";
    return query || "Web search";
  }
}

// Get step title for detail view
function getStepTitle(step: StepItem): string {
  if (step.type === "reasoning") {
    return "Thought process";
  } else {
    const { query } = extractSearchData(step.data);
    return query || "Web search";
  }
}

export function StepsModal({
  visible,
  onClose,
  steps,
  colors,
}: StepsModalProps) {
  const [selectedStep, setSelectedStep] = useState<StepItem | null>(null);
  const insets = useSafeAreaInsets();

  // Animation values
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(MODAL_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      // Animate in - backdrop fades quickly, sheet slides up
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset values when not visible
      backdropOpacity.setValue(0);
      sheetTranslateY.setValue(MODAL_HEIGHT);
    }
  }, [visible, backdropOpacity, sheetTranslateY]);

  const animateOut = (callback: () => void) => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: MODAL_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(callback);
  };

  const handleClose = () => {
    animateOut(() => {
      setSelectedStep(null);
      onClose();
    });
  };

  const handleBack = () => {
    setSelectedStep(null);
  };

  const markdownStyles = {
    body: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 24,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 12,
    },
    heading1: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "700" as const,
      marginTop: 16,
      marginBottom: 8,
    },
    heading2: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "600" as const,
      marginTop: 12,
      marginBottom: 6,
    },
    list_item: {
      marginVertical: 4,
    },
    bullet_list: {
      marginVertical: 8,
    },
    ordered_list: {
      marginVertical: 8,
    },
    strong: {
      fontWeight: "700" as const,
    },
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      onRequestClose={handleClose}
    >
      {/* Backdrop - fades in */}
      <TouchableWithoutFeedback onPress={handleClose}>
        <Animated.View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            opacity: backdropOpacity,
          }}
        />
      </TouchableWithoutFeedback>

      {/* Bottom sheet content - slides up */}
      <Animated.View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: MODAL_HEIGHT,
          backgroundColor: colors.background,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          paddingBottom: insets.bottom,
          transform: [{ translateY: sheetTranslateY }],
        }}
      >
        {/* Drag handle */}
        <View
          style={{
            alignItems: "center",
            paddingTop: 8,
            paddingBottom: 4,
          }}
        >
          <View
            style={{
              width: 36,
              height: 5,
              borderRadius: 3,
              backgroundColor: colors.border,
            }}
          />
        </View>

        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          {selectedStep ? (
            <Pressable
              onPress={handleBack}
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 16 }}>Summary</Text>
            </Pressable>
          ) : (
            <Pressable onPress={handleClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          )}
          <Text
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 17,
              fontWeight: "600",
              color: colors.text,
              marginRight: selectedStep ? 0 : 24,
            }}
          >
            {selectedStep ? getStepTitle(selectedStep) : "Summary"}
          </Text>
          {selectedStep && <View style={{ width: 60 }} />}
        </View>

        {/* Content */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
        >
          {selectedStep ? (
            // Detail view
            selectedStep.type === "reasoning" ? (
              <Markdown style={markdownStyles}>{selectedStep.text}</Markdown>
            ) : (
              // Search results view
              <SearchResultsView step={selectedStep} colors={colors} />
            )
          ) : (
            // Steps list view
            <View>
              {steps.map((step, index) => (
                <StepListItem
                  key={step.id}
                  step={step}
                  isLast={index === steps.length - 1}
                  colors={colors}
                  onPress={() => setSelectedStep(step)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

interface StepListItemProps {
  step: StepItem;
  isLast: boolean;
  colors: DerivedColors;
  onPress: () => void;
}

function StepListItem({ step, isLast, colors, onPress }: StepListItemProps) {
  const isSearching = step.type === "search" && step.data.state !== "result";
  const hasContent =
    step.type === "reasoning" ? step.text.length > 0 : !isSearching;

  return (
    <Pressable
      onPress={hasContent ? onPress : undefined}
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        paddingVertical: 12,
        opacity: hasContent ? 1 : 0.6,
      }}
    >
      {/* Left indicator column */}
      <View style={{ width: 24, alignItems: "center" }}>
        {/* Dot or globe icon */}
        {step.type === "search" ? (
          <Ionicons
            name="globe-outline"
            size={18}
            color={colors.textMuted}
            style={{ marginTop: 2 }}
          />
        ) : (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.textMuted,
              marginTop: 7,
            }}
          />
        )}
      </View>

      {/* Content */}
      <View style={{ flex: 1, marginLeft: 8 }}>
        <Text
          style={{
            color: colors.text,
            fontSize: 16,
            lineHeight: 22,
          }}
          numberOfLines={2}
        >
          {getStepLabel(step)}
        </Text>
      </View>

      {/* Chevron */}
      {hasContent && (
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.textMuted}
          style={{ marginLeft: 8, marginTop: 2 }}
        />
      )}

      {/* Loading indicator for searching */}
      {step.type === "search" && isSearching && (
        <ActivityIndicator
          size="small"
          color={colors.textMuted}
          style={{ marginLeft: 8 }}
        />
      )}
    </Pressable>
  );
}

interface SearchResultsViewProps {
  step: StepItem & { type: "search" };
  colors: DerivedColors;
}

function SearchResultsView({ step, colors }: SearchResultsViewProps) {
  const { results } = extractSearchData(step.data);

  return (
    <View>
      {results.map((result, index) => (
        <Pressable
          key={index}
          onPress={() => Linking.openURL(result.url)}
          style={{
            paddingVertical: 14,
            borderBottomWidth: index < results.length - 1 ? 1 : 0,
            borderBottomColor: colors.border,
          }}
        >
          <Text
            style={{
              color: colors.text,
              fontSize: 16,
              fontWeight: "500",
              marginBottom: 4,
            }}
            numberOfLines={2}
          >
            {result.title}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Image
              source={{
                uri: `https://www.google.com/s2/favicons?sz=64&domain=${result.domain}`,
              }}
              style={{ width: 16, height: 16, borderRadius: 2 }}
            />
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>
              {result.domain}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

// Helper function to build steps from message parts
export function buildStepsFromParts(
  parts: MessagePart[],
  isStreaming?: boolean,
  isActivelyThinking?: boolean
): StepItem[] {
  const steps: StepItem[] = [];

  for (const part of parts) {
    if (part.type === "reasoning") {
      const reasoningPart = part as ReasoningPart;
      if (reasoningPart.text.trim()) {
        const isStillThinking = !!(isStreaming && !reasoningPart.duration);
        steps.push({
          type: "reasoning",
          text: reasoningPart.text,
          isThinking: isStillThinking,
          duration: reasoningPart.duration,
          id: reasoningPart.id || `reasoning-${steps.length}`,
        });
      }
    } else if (part.type === "tool-invocation") {
      const toolPart = part as ToolInvocationPart;
      if (toolPart.toolName.toLowerCase().includes("search")) {
        steps.push({
          type: "search",
          data: toolPart,
          id: toolPart.toolInvocationId,
        });
      }
    }
  }

  // Add actively thinking indicator
  if (isActivelyThinking) {
    const lastStep = steps[steps.length - 1];
    if (lastStep && lastStep.type === "reasoning") {
      lastStep.isThinking = true;
    } else {
      steps.push({
        type: "reasoning",
        text: "",
        isThinking: true,
        id: `thinking-active`,
      });
    }
  }

  return steps;
}
