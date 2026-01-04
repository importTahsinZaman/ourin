import React from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/providers/ThemeProvider";

interface FontPickerModalProps {
  visible: boolean;
  onClose: () => void;
}

export function FontPickerModal({ visible, onClose }: FontPickerModalProps) {
  const { fontId, setFont, availableFonts, colors } = useTheme();

  const handleSelect = (id: string) => {
    setFont(id);
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
            Choose Font
          </Text>
          <Pressable onPress={onClose} style={{ padding: 4 }}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </Pressable>
        </View>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        >
          <Text
            style={{
              fontSize: 14,
              color: colors.textMuted,
              marginBottom: 20,
              lineHeight: 20,
            }}
          >
            Select a font for the app interface. Note: Custom fonts are
            available on web only. On mobile, all options use the system font.
          </Text>
          {availableFonts.map((font) => {
            const isSelected = fontId === font.id;
            return (
              <Pressable
                key={font.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 14,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                  marginBottom: 4,
                  backgroundColor: isSelected
                    ? colors.backgroundSecondary
                    : "transparent",
                }}
                onPress={() => handleSelect(font.id)}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "500",
                    color: colors.text,
                  }}
                >
                  {font.name}
                </Text>
                {isSelected && (
                  <Ionicons name="checkmark" size={20} color={colors.accent} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
