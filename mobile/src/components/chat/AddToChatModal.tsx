import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  Animated,
  Dimensions,
  Switch,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/providers/ThemeProvider";
import { getModelInfo, canDisableReasoning } from "@ourin/shared/models";
import type { Core } from "@/hooks/useCores";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.48;

type ViewType = "main" | "reasoning" | "cores";

interface AddToChatModalProps {
  visible: boolean;
  onClose: () => void;
  // File attachments
  onTakePhoto: () => void;
  onPickImage: () => void;
  onPickDocument: () => void;
  // Web search
  webSearchEnabled: boolean;
  onWebSearchToggle: (enabled: boolean) => void;
  modelSupportsWebSearch: boolean;
  // Reasoning
  selectedModel: string;
  reasoningLevel: string | number;
  onSelectReasoningLevel: (level: string | number) => void;
  modelSupportsReasoning: boolean;
  // Cores
  cores: Core[];
  activeCoresCount: number;
  onToggleCore: (id: string) => void;
}

export function AddToChatModal({
  visible,
  onClose,
  onTakePhoto,
  onPickImage,
  onPickDocument,
  webSearchEnabled,
  onWebSearchToggle,
  modelSupportsWebSearch,
  selectedModel,
  reasoningLevel,
  onSelectReasoningLevel,
  modelSupportsReasoning,
  cores,
  activeCoresCount,
  onToggleCore,
}: AddToChatModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [currentView, setCurrentView] = useState<ViewType>("main");

  // Animation values
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(MODAL_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      setCurrentView("main");
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
      backdropOpacity.setValue(0);
      sheetTranslateY.setValue(MODAL_HEIGHT);
    }
  }, [visible, backdropOpacity, sheetTranslateY]);

  const handleClose = () => {
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
    ]).start(() => {
      onClose();
    });
  };

  const handleAttachment = (action: () => void) => {
    handleClose();
    setTimeout(action, 300);
  };

  // Get reasoning options
  const modelInfo = getModelInfo(selectedModel);
  const reasoningParam = modelInfo.reasoningParameter;
  const canDisable = canDisableReasoning(selectedModel);

  const getReasoningOptions = () => {
    if (!reasoningParam) return [];

    const options: {
      value: string | number;
      label: string;
      description?: string;
    }[] = [];

    if (canDisable) {
      options.push({
        value: "off",
        label: "Off",
        description: "No extended thinking",
      });
    }

    if (reasoningParam.kind === "effort" && reasoningParam.allowedValues) {
      reasoningParam.allowedValues.forEach((val) => {
        options.push({
          value: val,
          label: val.charAt(0).toUpperCase() + val.slice(1),
          description:
            val === "low"
              ? "Quick responses"
              : val === "medium"
                ? "Balanced thinking"
                : "Deep analysis",
        });
      });
    } else if (reasoningParam.kind === "budget" && reasoningParam.presets) {
      reasoningParam.presets.forEach((preset) => {
        options.push({
          value: preset.value,
          label: preset.label,
          description: `${preset.value.toLocaleString()} tokens`,
        });
      });
    }

    return options;
  };

  const getReasoningLabel = () => {
    if (reasoningLevel === "off") return "Off";
    if (reasoningParam?.kind === "effort") {
      return (
        (reasoningLevel as string).charAt(0).toUpperCase() +
        (reasoningLevel as string).slice(1)
      );
    }
    if (reasoningParam?.kind === "budget" && reasoningParam.presets) {
      const preset = reasoningParam.presets.find(
        (p) => p.value === reasoningLevel
      );
      return preset?.label || "Custom";
    }
    return "On";
  };

  const renderMainView = () => (
    <>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <Pressable onPress={handleClose} style={{ padding: 4 }}>
          <Ionicons name="close" size={24} color={colors.textMuted} />
        </Pressable>
        <Text
          style={{
            flex: 1,
            fontSize: 16,
            fontWeight: "600",
            color: colors.text,
            textAlign: "center",
            marginRight: 32,
          }}
        >
          Add to Chat
        </Text>
      </View>

      {/* Attachment Buttons */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 16,
          paddingVertical: 12,
          gap: 12,
        }}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: colors.backgroundSecondary,
            borderRadius: 12,
            paddingVertical: 20,
            alignItems: "center",
            gap: 8,
          }}
          onPress={() => handleAttachment(onTakePhoto)}
        >
          <Ionicons name="camera-outline" size={28} color={colors.text} />
          <Text style={{ fontSize: 14, color: colors.text }}>Camera</Text>
        </Pressable>

        <Pressable
          style={{
            flex: 1,
            backgroundColor: colors.backgroundSecondary,
            borderRadius: 12,
            paddingVertical: 20,
            alignItems: "center",
            gap: 8,
          }}
          onPress={() => handleAttachment(onPickImage)}
        >
          <Ionicons name="image-outline" size={28} color={colors.text} />
          <Text style={{ fontSize: 14, color: colors.text }}>Photos</Text>
        </Pressable>

        <Pressable
          style={{
            flex: 1,
            backgroundColor: colors.backgroundSecondary,
            borderRadius: 12,
            paddingVertical: 20,
            alignItems: "center",
            gap: 8,
          }}
          onPress={() => handleAttachment(onPickDocument)}
        >
          <Ionicons name="document-outline" size={28} color={colors.text} />
          <Text style={{ fontSize: 14, color: colors.text }}>Files</Text>
        </Pressable>
      </View>

      {/* Divider */}
      <View
        style={{
          height: 1,
          backgroundColor: colors.border,
          marginHorizontal: 16,
          marginVertical: 8,
        }}
      />

      {/* Web Search Toggle */}
      {modelSupportsWebSearch && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 14,
          }}
        >
          <Ionicons name="globe-outline" size={22} color={colors.textMuted} />
          <Text
            style={{
              flex: 1,
              fontSize: 16,
              color: colors.text,
              marginLeft: 12,
            }}
          >
            Web search
          </Text>
          <Switch
            value={webSearchEnabled}
            onValueChange={onWebSearchToggle}
            trackColor={{
              false: colors.backgroundTertiary,
              true: colors.accent,
            }}
            thumbColor="#fff"
          />
        </View>
      )}

      {/* Reasoning Row */}
      {modelSupportsReasoning && (
        <Pressable
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 14,
          }}
          onPress={() => setCurrentView("reasoning")}
        >
          <Ionicons name="bulb-outline" size={22} color={colors.textMuted} />
          <Text
            style={{
              flex: 1,
              fontSize: 16,
              color: colors.text,
              marginLeft: 12,
            }}
          >
            Reasoning
          </Text>
          <Text
            style={{ fontSize: 15, color: colors.textMuted, marginRight: 4 }}
          >
            {getReasoningLabel()}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>
      )}

      {/* Divider */}
      <View
        style={{
          height: 1,
          backgroundColor: colors.border,
          marginHorizontal: 16,
          marginVertical: 8,
        }}
      />

      {/* Cores Row */}
      <Pressable
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 14,
        }}
        onPress={() => setCurrentView("cores")}
      >
        <Ionicons name="layers-outline" size={22} color={colors.textMuted} />
        <Text
          style={{ flex: 1, fontSize: 16, color: colors.text, marginLeft: 12 }}
        >
          Cores
        </Text>
        <Text style={{ fontSize: 15, color: colors.textMuted, marginRight: 4 }}>
          {activeCoresCount} active
        </Text>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Pressable>
    </>
  );

  const renderReasoningView = () => (
    <>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <Pressable
          onPress={() => setCurrentView("main")}
          style={{ flexDirection: "row", alignItems: "center" }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textMuted} />
          <Text style={{ fontSize: 15, color: colors.textMuted }}>
            Add to Chat
          </Text>
        </Pressable>
        <Text
          style={{
            flex: 1,
            fontSize: 16,
            fontWeight: "600",
            color: colors.text,
            textAlign: "center",
            marginRight: 100,
          }}
        >
          Reasoning
        </Text>
      </View>

      {/* Options */}
      <ScrollView style={{ flex: 1 }}>
        {getReasoningOptions().map((option) => (
          <Pressable
            key={String(option.value)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 14,
            }}
            onPress={() => {
              onSelectReasoningLevel(option.value);
              setCurrentView("main");
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, color: colors.text }}>
                {option.label}
              </Text>
              {option.description && (
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.textMuted,
                    marginTop: 2,
                  }}
                >
                  {option.description}
                </Text>
              )}
            </View>
            {reasoningLevel === option.value && (
              <Ionicons name="checkmark" size={22} color={colors.accent} />
            )}
          </Pressable>
        ))}
      </ScrollView>
    </>
  );

  const renderCoresView = () => (
    <>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <Pressable
          onPress={() => setCurrentView("main")}
          style={{ flexDirection: "row", alignItems: "center" }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textMuted} />
          <Text style={{ fontSize: 15, color: colors.textMuted }}>
            Add to Chat
          </Text>
        </Pressable>
        <Text
          style={{
            flex: 1,
            fontSize: 16,
            fontWeight: "600",
            color: colors.text,
            textAlign: "center",
            marginRight: 100,
          }}
        >
          Cores
        </Text>
      </View>

      {/* Cores List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom }}
      >
        {cores.length === 0 ? (
          <Text
            style={{
              fontSize: 15,
              color: colors.textMuted,
              textAlign: "center",
              paddingVertical: 20,
            }}
          >
            No cores available
          </Text>
        ) : (
          cores.map((core) => (
            <Pressable
              key={core.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 14,
              }}
              onPress={() => onToggleCore(core.id)}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, color: colors.text }}>
                  {core.name}
                </Text>
                {core.description && (
                  <Text
                    style={{
                      fontSize: 13,
                      color: colors.textMuted,
                      marginTop: 2,
                    }}
                    numberOfLines={1}
                  >
                    {core.description}
                  </Text>
                )}
              </View>
              <Switch
                value={core.isActive}
                onValueChange={() => onToggleCore(core.id)}
                trackColor={{
                  false: colors.backgroundTertiary,
                  true: colors.accent,
                }}
                thumbColor="#fff"
              />
            </Pressable>
          ))
        )}
      </ScrollView>
    </>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      {/* Backdrop */}
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          opacity: backdropOpacity,
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={handleClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: MODAL_HEIGHT,
          backgroundColor: colors.background,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          transform: [{ translateY: sheetTranslateY }],
          paddingBottom: insets.bottom,
        }}
      >
        {/* Handle */}
        <View
          style={{ alignItems: "center", paddingTop: 10, paddingBottom: 6 }}
        >
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
            }}
          />
        </View>

        {currentView === "main" && renderMainView()}
        {currentView === "reasoning" && renderReasoningView()}
        {currentView === "cores" && renderCoresView()}
      </Animated.View>
    </Modal>
  );
}
