import React, { useCallback, useMemo, forwardRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
} from "react-native";
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { type Core } from "@/hooks/useCores";

interface CorePickerProps {
  cores: Core[];
  activeCoresCount: number;
  onToggleCore: (coreId: string) => Promise<boolean>;
}

export const CorePicker = forwardRef<BottomSheetModal, CorePickerProps>(
  ({ cores, activeCoresCount, onToggleCore }, ref) => {
    const snapPoints = useMemo(() => ["70%"], []);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
        />
      ),
      []
    );

    const handleToggle = useCallback(
      async (core: Core) => {
        // Prevent deactivating the last active core
        if (core.isActive && activeCoresCount <= 1) {
          Alert.alert(
            "Cannot Deactivate",
            "You must have at least one active core."
          );
          return;
        }
        await onToggleCore(core.id);
      },
      [onToggleCore, activeCoresCount]
    );

    const sortedCores = useMemo(
      () => [...cores].sort((a, b) => a.order - b.order),
      [cores]
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.indicator}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Cores</Text>
            <Text style={styles.subtitle}>
              {activeCoresCount} active core{activeCoresCount !== 1 ? "s" : ""}
            </Text>
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
        </View>
      </BottomSheetModal>
    );
  }
);

CorePicker.displayName = "CorePicker";

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
  background: {
    backgroundColor: "#1f1f1f",
  },
  indicator: {
    backgroundColor: "#666",
    width: 40,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#f5f5f4",
  },
  subtitle: {
    fontSize: 13,
    color: "#9ca3af",
  },
  description: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 16,
    lineHeight: 18,
  },
  scrollView: {
    flex: 1,
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
