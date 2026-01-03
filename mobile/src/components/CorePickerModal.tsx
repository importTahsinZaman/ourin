import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  SafeAreaView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Cores</Text>
            <Text style={styles.subtitle}>
              {activeCoresCount} active core{activeCoresCount !== 1 ? "s" : ""}
            </Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#9ca3af" />
          </Pressable>
        </View>
        <Text style={styles.description}>
          Cores are custom instructions that shape how the AI responds. Toggle
          cores on/off to customize your experience.
        </Text>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {sortedCores.map((core) => (
            <CoreRow
              key={core.id}
              core={core}
              onToggle={() => handleToggle(core)}
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
}

function CoreRow({ core, onToggle }: CoreRowProps) {
  return (
    <Pressable
      style={[styles.coreRow, core.isActive && styles.coreRowActive]}
      onPress={onToggle}
    >
      <View style={styles.coreInfo}>
        <View style={styles.coreNameRow}>
          <Text style={styles.coreName}>{core.name}</Text>
        </View>
        <Text style={styles.coreContent} numberOfLines={2}>
          {core.content}
        </Text>
      </View>
      <View
        style={[
          styles.toggleCircle,
          core.isActive && styles.toggleCircleActive,
        ]}
      >
        {core.isActive && <Ionicons name="checkmark" size={14} color="#fff" />}
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
    alignItems: "flex-start",
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
  subtitle: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  description: {
    fontSize: 13,
    color: "#6b7280",
    paddingHorizontal: 16,
    paddingTop: 12,
    lineHeight: 18,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  coreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: "#2a2a2a",
    borderWidth: 1,
    borderColor: "transparent",
  },
  coreRowActive: {
    borderColor: "#d97756",
    backgroundColor: "#2a2a2a",
  },
  coreInfo: {
    flex: 1,
    marginRight: 12,
  },
  coreNameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  coreName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f5f5f4",
  },
  coreContent: {
    fontSize: 13,
    color: "#9ca3af",
    lineHeight: 18,
  },
  toggleCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#4b5563",
    alignItems: "center",
    justifyContent: "center",
  },
  toggleCircleActive: {
    backgroundColor: "#d97756",
    borderColor: "#d97756",
  },
});
