import React, { useCallback, useMemo, forwardRef } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import {
  MODELS_BY_DATE,
  FREE_MODEL_ID,
  type Model,
} from "@ourin/shared/models";

interface ModelPickerProps {
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
}

export const ModelPicker = forwardRef<BottomSheetModal, ModelPickerProps>(
  ({ selectedModel, onSelectModel }, ref) => {
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

    const handleSelect = useCallback(
      (modelId: string) => {
        onSelectModel(modelId);
        (ref as React.RefObject<BottomSheetModal>).current?.dismiss();
      },
      [onSelectModel, ref]
    );

    // Group models by provider
    const modelsByProvider = useMemo(() => {
      const groups: Record<string, Model[]> = {
        google: [],
        anthropic: [],
        openai: [],
      };
      MODELS_BY_DATE.forEach((model) => {
        groups[model.provider].push(model);
      });
      return groups;
    }, []);

    const providerNames: Record<string, string> = {
      google: "Google",
      anthropic: "Anthropic",
      openai: "OpenAI",
    };

    const providerOrder = ["anthropic", "google", "openai"];

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.indicator}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Select Model</Text>
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            {providerOrder.map((provider) => (
              <View key={provider} style={styles.providerSection}>
                <Text style={styles.providerName}>
                  {providerNames[provider]}
                </Text>
                {modelsByProvider[provider].map((model) => (
                  <ModelRow
                    key={model.id}
                    model={model}
                    isSelected={selectedModel === model.id}
                    isFree={model.id === FREE_MODEL_ID}
                    onPress={() => handleSelect(model.id)}
                  />
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </BottomSheetModal>
    );
  }
);

ModelPicker.displayName = "ModelPicker";

interface ModelRowProps {
  model: Model;
  isSelected: boolean;
  isFree: boolean;
  onPress: () => void;
}

function ModelRow({ model, isSelected, isFree, onPress }: ModelRowProps) {
  const hasReasoning = !!model.reasoningParameter;

  return (
    <Pressable
      style={[styles.modelRow, isSelected && styles.modelRowSelected]}
      onPress={onPress}
    >
      <View style={styles.modelInfo}>
        <View style={styles.modelNameRow}>
          <Text style={styles.modelName}>{model.name}</Text>
          {hasReasoning && (
            <Ionicons
              name="bulb-outline"
              size={14}
              color="#d97756"
              style={styles.reasoningIcon}
            />
          )}
          {isFree && (
            <View style={styles.freeBadge}>
              <Text style={styles.freeBadgeText}>FREE</Text>
            </View>
          )}
        </View>
        <Text style={styles.modelDescription} numberOfLines={1}>
          {model.description}
        </Text>
      </View>
      {isSelected && <Ionicons name="checkmark" size={20} color="#d97756" />}
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
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#f5f5f4",
    textAlign: "center",
    marginBottom: 16,
  },
  scrollView: {
    flex: 1,
  },
  providerSection: {
    marginBottom: 20,
  },
  providerName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingLeft: 4,
  },
  modelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  modelRowSelected: {
    backgroundColor: "#2a2a2a",
  },
  modelInfo: {
    flex: 1,
    marginRight: 12,
  },
  modelNameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  modelName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#f5f5f4",
  },
  reasoningIcon: {
    marginLeft: 6,
  },
  freeBadge: {
    backgroundColor: "#22c55e",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  freeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
  },
  modelDescription: {
    fontSize: 13,
    color: "#9ca3af",
  },
});
