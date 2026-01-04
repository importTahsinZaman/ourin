import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  SafeAreaView,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/providers/ThemeProvider";
import type { OurinTheme } from "@ourin/core";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - 32 - CARD_GAP) / 2;

interface ThemePickerModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ThemePickerModal({ visible, onClose }: ThemePickerModalProps) {
  const { themeId, setTheme, lightThemes, darkThemes, customThemes } =
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
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose Theme</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#9ca3af" />
          </Pressable>
        </View>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Custom Themes */}
          {customThemes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Custom Themes</Text>
              {customThemeRows.map((row, rowIndex) => (
                <View key={`custom-row-${rowIndex}`} style={styles.row}>
                  {row.map((theme) => (
                    <ThemeCard
                      key={theme.id}
                      theme={theme}
                      isSelected={themeId === theme.id}
                      onPress={() => handleSelect(theme.id)}
                    />
                  ))}
                  {row.length === 1 && <View style={styles.cardPlaceholder} />}
                </View>
              ))}
            </View>
          )}

          {/* Light Themes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Light Themes</Text>
            {lightThemeRows.map((row, rowIndex) => (
              <View key={`light-row-${rowIndex}`} style={styles.row}>
                {row.map((theme) => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    isSelected={themeId === theme.id}
                    onPress={() => handleSelect(theme.id)}
                  />
                ))}
                {row.length === 1 && <View style={styles.cardPlaceholder} />}
              </View>
            ))}
          </View>

          {/* Dark Themes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dark Themes</Text>
            {darkThemeRows.map((row, rowIndex) => (
              <View key={`dark-row-${rowIndex}`} style={styles.row}>
                {row.map((theme) => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    isSelected={themeId === theme.id}
                    onPress={() => handleSelect(theme.id)}
                  />
                ))}
                {row.length === 1 && <View style={styles.cardPlaceholder} />}
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
}

function ThemeCard({ theme, isSelected, onPress }: ThemeCardProps) {
  return (
    <Pressable
      style={[
        styles.card,
        isSelected && styles.cardSelected,
        { borderColor: isSelected ? theme.colors.accent : "#333" },
      ]}
      onPress={onPress}
    >
      {/* Color swatches */}
      <View style={styles.swatches}>
        <View
          style={[
            styles.swatch,
            styles.swatchBackground,
            { backgroundColor: theme.colors.background },
          ]}
        />
        <View
          style={[
            styles.swatch,
            styles.swatchText,
            { backgroundColor: theme.colors.text },
          ]}
        />
        <View
          style={[
            styles.swatch,
            styles.swatchAccent,
            { backgroundColor: theme.colors.accent },
          ]}
        />
      </View>

      {/* Theme name and check */}
      <View style={styles.cardFooter}>
        <Text style={styles.themeName} numberOfLines={1}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1f1f1f",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#f5f5f4",
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    gap: CARD_GAP,
    marginBottom: CARD_GAP,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: "#262626",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#333",
    overflow: "hidden",
  },
  cardSelected: {
    backgroundColor: "#2a2a2a",
  },
  cardPlaceholder: {
    width: CARD_WIDTH,
  },
  swatches: {
    flexDirection: "row",
    height: 60,
  },
  swatch: {
    flex: 1,
  },
  swatchBackground: {
    borderTopLeftRadius: 10,
  },
  swatchText: {},
  swatchAccent: {
    borderTopRightRadius: 10,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  themeName: {
    fontSize: 13,
    fontWeight: "500",
    color: "#f5f5f4",
    flex: 1,
  },
});
