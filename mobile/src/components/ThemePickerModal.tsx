import React, { useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  SafeAreaView,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, type DerivedColors } from "@/providers/ThemeProvider";
import type { OurinTheme } from "@ourin/core";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - 32 - CARD_GAP) / 2;

interface ThemePickerModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ThemePickerModal({ visible, onClose }: ThemePickerModalProps) {
  const { themeId, setTheme, lightThemes, darkThemes, customThemes, colors } =
    useTheme();

  const handleSelect = (id: string) => {
    setTheme(id);
    onClose();
  };

  // Split themes into rows of 2 for grid layout
  const lightThemeRows = useMemo(() => {
    const rows: OurinTheme[][] = [];
    for (let i = 0; i < lightThemes.length; i += 2) {
      rows.push(lightThemes.slice(i, i + 2));
    }
    return rows;
  }, [lightThemes]);

  const darkThemeRows = useMemo(() => {
    const rows: OurinTheme[][] = [];
    for (let i = 0; i < darkThemes.length; i += 2) {
      rows.push(darkThemes.slice(i, i + 2));
    }
    return rows;
  }, [darkThemes]);

  const customThemeRows = useMemo(() => {
    const rows: OurinTheme[][] = [];
    for (let i = 0; i < customThemes.length; i += 2) {
      rows.push(customThemes.slice(i, i + 2));
    }
    return rows;
  }, [customThemes]);

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
            Choose Theme
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
          {/* Custom Themes */}
          {customThemes.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: colors.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  marginBottom: 12,
                }}
              >
                Custom Themes
              </Text>
              {customThemeRows.map((row, rowIndex) => (
                <View
                  key={`custom-row-${rowIndex}`}
                  style={{
                    flexDirection: "row",
                    gap: CARD_GAP,
                    marginBottom: CARD_GAP,
                  }}
                >
                  {row.map((theme) => (
                    <ThemeCard
                      key={theme.id}
                      theme={theme}
                      isSelected={themeId === theme.id}
                      onPress={() => handleSelect(theme.id)}
                      colors={colors}
                    />
                  ))}
                  {row.length === 1 && <View style={{ width: CARD_WIDTH }} />}
                </View>
              ))}
            </View>
          )}

          {/* Light Themes */}
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: colors.textMuted,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 12,
              }}
            >
              Light Themes
            </Text>
            {lightThemeRows.map((row, rowIndex) => (
              <View
                key={`light-row-${rowIndex}`}
                style={{
                  flexDirection: "row",
                  gap: CARD_GAP,
                  marginBottom: CARD_GAP,
                }}
              >
                {row.map((theme) => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    isSelected={themeId === theme.id}
                    onPress={() => handleSelect(theme.id)}
                    colors={colors}
                  />
                ))}
                {row.length === 1 && <View style={{ width: CARD_WIDTH }} />}
              </View>
            ))}
          </View>

          {/* Dark Themes */}
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: colors.textMuted,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 12,
              }}
            >
              Dark Themes
            </Text>
            {darkThemeRows.map((row, rowIndex) => (
              <View
                key={`dark-row-${rowIndex}`}
                style={{
                  flexDirection: "row",
                  gap: CARD_GAP,
                  marginBottom: CARD_GAP,
                }}
              >
                {row.map((theme) => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    isSelected={themeId === theme.id}
                    onPress={() => handleSelect(theme.id)}
                    colors={colors}
                  />
                ))}
                {row.length === 1 && <View style={{ width: CARD_WIDTH }} />}
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

interface ThemeCardProps {
  theme: OurinTheme;
  isSelected: boolean;
  onPress: () => void;
  colors: DerivedColors;
}

function ThemeCard({ theme, isSelected, onPress, colors }: ThemeCardProps) {
  return (
    <Pressable
      style={{
        width: CARD_WIDTH,
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: isSelected ? theme.colors.accent : colors.border,
        overflow: "hidden",
      }}
      onPress={onPress}
    >
      {/* Color swatches */}
      <View style={{ flexDirection: "row", height: 60 }}>
        <View
          style={{
            flex: 1,
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: 10,
          }}
        />
        <View
          style={{
            flex: 1,
            backgroundColor: theme.colors.text,
          }}
        />
        <View
          style={{
            flex: 1,
            backgroundColor: theme.colors.accent,
            borderTopRightRadius: 10,
          }}
        />
      </View>

      {/* Theme name and check */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 10,
          paddingVertical: 8,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: "500",
            color: colors.text,
            flex: 1,
          }}
          numberOfLines={1}
        >
          {theme.name}
        </Text>
        {isSelected && (
          <Ionicons
            name="checkmark-circle"
            size={18}
            color={theme.colors.accent}
          />
        )}
      </View>
    </Pressable>
  );
}
