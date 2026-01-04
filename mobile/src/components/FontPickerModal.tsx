import React from "react";
import {
  View,
  Text,
  StyleSheet,
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
  const { fontId, setFont, availableFonts, theme } = useTheme();

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
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose Font</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#9ca3af" />
          </Pressable>
        </View>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={styles.description}>
            Select a font for the app interface. Note: Custom fonts are
            available on web only. On mobile, all options use the system font.
          </Text>
          {availableFonts.map((font) => {
            const isSelected = fontId === font.id;
            return (
              <Pressable
                key={font.id}
                style={[styles.fontRow, isSelected && styles.fontRowSelected]}
                onPress={() => handleSelect(font.id)}
              >
                <Text style={styles.fontName}>{font.name}</Text>
                {isSelected && (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={theme.colors.accent}
                  />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
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
  description: {
    fontSize: 14,
    color: "#9ca3af",
    marginBottom: 20,
    lineHeight: 20,
  },
  fontRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 4,
  },
  fontRowSelected: {
    backgroundColor: "#2a2a2a",
  },
  fontName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#f5f5f4",
  },
});
