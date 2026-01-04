import React, { useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  SafeAreaView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, type DerivedColors } from "@/providers/ThemeProvider";
import { type Core } from "@/hooks/useCores";

interface CorePickerModalProps {
  visible: boolean;
  cores: Core[];
  activeCoresCount: number;
  onToggleCore: (coreId: string) => Promise<boolean>;
  onClose: () => void;
}

export function CorePickerModal({
  visible,
  cores,
  activeCoresCount,
  onToggleCore,
  onClose,
}: CorePickerModalProps) {
  const { colors } = useTheme();
  const sortedCores = useMemo(
    () => [...cores].sort((a, b) => a.order - b.order),
    [cores]
  );

  const handleToggle = async (core: Core) => {
    // Prevent deactivating the last active core
    if (core.isActive && activeCoresCount <= 1) {
      Alert.alert(
        "Cannot Deactivate",
        "You must have at least one active core."
      );
      return;
    }
    await onToggleCore(core.id);
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
            alignItems: "flex-start",
            paddingHorizontal: 16,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View>
            <Text
              style={{ fontSize: 18, fontWeight: "600", color: colors.text }}
            >
              Cores
            </Text>
            <Text
              style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}
            >
              {activeCoresCount} active core{activeCoresCount !== 1 ? "s" : ""}
            </Text>
          </View>
          <Pressable onPress={onClose} style={{ padding: 4 }}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </Pressable>
        </View>
        <Text
          style={{
            fontSize: 13,
            color: colors.textTertiary,
            paddingHorizontal: 16,
            paddingTop: 12,
            lineHeight: 18,
          }}
        >
          Cores are custom instructions that shape how the AI responds. Toggle
          cores on/off to customize your experience.
        </Text>
        <ScrollView
          style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {sortedCores.map((core) => (
            <CoreRow
              key={core.id}
              core={core}
              onToggle={() => handleToggle(core)}
              colors={colors}
            />
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

interface CoreRowProps {
  core: Core;
  onToggle: () => void;
  colors: DerivedColors;
}

function CoreRow({ core, onToggle, colors }: CoreRowProps) {
  return (
    <Pressable
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderRadius: 10,
        marginBottom: 8,
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: core.isActive ? colors.accent : "transparent",
      }}
      onPress={onToggle}
    >
      <View style={{ flex: 1, marginRight: 12 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>
            {core.name}
          </Text>
        </View>
        <Text
          style={{ fontSize: 13, color: colors.textMuted, lineHeight: 18 }}
          numberOfLines={2}
        >
          {core.content}
        </Text>
      </View>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: core.isActive ? colors.accent : colors.textTertiary,
          backgroundColor: core.isActive ? colors.accent : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {core.isActive && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
    </Pressable>
  );
}
