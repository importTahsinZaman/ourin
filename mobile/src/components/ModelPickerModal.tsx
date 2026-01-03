import React, { useMemo } from "react";
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
import {
  MODELS_BY_DATE,
  FREE_MODEL_ID,
  type Model,
} from "@ourin/shared/models";

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

  const handleSelect = (modelId: string) => {
    onSelectModel(modelId);
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
          <Text style={styles.title}>Select Model</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#9ca3af" />
          </Pressable>
        </View>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {providerOrder.map((provider) => (
            <View key={provider} style={styles.providerSection}>
              <Text style={styles.providerName}>{providerNames[provider]}</Text>
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
      </SafeAreaView>
    </Modal>
  );
}

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
    paddingHorizontal: 16,
    paddingTop: 16,
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
