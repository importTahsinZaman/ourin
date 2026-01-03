import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Keyboard,
  type TextInput as TextInputType,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ChatInputProps {
  onSend: (text: string) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  placeholder?: string;
  modelName?: string;
  activeCoresCount?: number;
  onOpenModelPicker?: () => void;
  onOpenCorePicker?: () => void;
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  placeholder = "Message",
  modelName,
  activeCoresCount = 0,
  onOpenModelPicker,
  onOpenCorePicker,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<TextInputType>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    onSend(trimmed);
    setText("");
    Keyboard.dismiss();
  };

  const handleStop = () => {
    onStop?.();
  };

  const canSend = text.trim().length > 0 && !isStreaming;

  return (
    <View style={styles.container}>
      {/* Model and Cores toolbar */}
      <View style={styles.toolbar}>
        <Pressable style={styles.toolbarButton} onPress={onOpenModelPicker}>
          <Ionicons name="cube-outline" size={16} color="#9ca3af" />
          <Text style={styles.toolbarButtonText} numberOfLines={1}>
            {modelName || "Model"}
          </Text>
          <Ionicons name="chevron-down" size={14} color="#6b7280" />
        </Pressable>

        <Pressable style={styles.toolbarButton} onPress={onOpenCorePicker}>
          <Ionicons name="layers-outline" size={16} color="#9ca3af" />
          <Text style={styles.toolbarButtonText}>
            {activeCoresCount} Core{activeCoresCount !== 1 ? "s" : ""}
          </Text>
          <Ionicons name="chevron-down" size={14} color="#6b7280" />
        </Pressable>
      </View>

      <View style={styles.inputWrapper}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor="#666"
          multiline
          maxLength={32000}
          editable={!isStreaming}
        />
        <View style={styles.buttonRow}>
          {/* Attachment button - placeholder for now */}
          <Pressable
            style={styles.iconButton}
            onPress={() => {
              // TODO: Implement file picker
            }}
          >
            <Ionicons name="add" size={22} color="#a3a3a3" />
          </Pressable>

          {/* Send/Stop button */}
          {isStreaming ? (
            <Pressable
              style={[styles.sendButton, styles.stopButton]}
              onPress={handleStop}
            >
              <Ionicons name="stop" size={18} color="#fff" />
            </Pressable>
          ) : (
            <Pressable
              style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!canSend}
            >
              <Ionicons
                name="arrow-up"
                size={18}
                color={canSend ? "#fff" : "#666"}
              />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
    backgroundColor: "#1a1a1a",
  },
  toolbar: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  toolbarButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#262626",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  toolbarButtonText: {
    fontSize: 13,
    color: "#9ca3af",
    maxWidth: 100,
  },
  inputWrapper: {
    backgroundColor: "#262626",
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    minHeight: 56,
  },
  input: {
    fontSize: 16,
    color: "#f5f5f4",
    maxHeight: 120,
    paddingHorizontal: 2,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#404040",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#d97756",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#404040",
  },
  stopButton: {
    backgroundColor: "#ef4444",
  },
});
