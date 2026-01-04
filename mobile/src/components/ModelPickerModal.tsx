import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  Animated,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, type DerivedColors } from "@/providers/ThemeProvider";
import { MODELS_BY_DATE, type Model } from "@ourin/shared/models";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.45;

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
  const insets = useSafeAreaInsets();

  // Animation values
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(MODAL_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
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

  const handleSelect = (modelId: string) => {
    onSelectModel(modelId);
    handleClose();
  };

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
        }}
      >
        {/* Handle */}
        <View
          style={{
            alignItems: "center",
            paddingTop: 10,
            paddingBottom: 6,
          }}
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

        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "600", color: colors.text }}>
            Select Model
          </Text>
          <Pressable onPress={handleClose} style={{ padding: 4 }}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Content */}
        <ScrollView
          style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          showsVerticalScrollIndicator={false}
        >
          {MODELS_BY_DATE.map((model) => (
            <ModelRow
              key={model.id}
              model={model}
              isSelected={selectedModel === model.id}
              onPress={() => handleSelect(model.id)}
              colors={colors}
            />
          ))}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

interface ModelRowProps {
  model: Model;
  isSelected: boolean;
  onPress: () => void;
  colors: DerivedColors;
}

function ModelRow({ model, isSelected, onPress, colors }: ModelRowProps) {
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
