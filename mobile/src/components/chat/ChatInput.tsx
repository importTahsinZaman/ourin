import React, { useState, useRef } from "react";
import {
  View,
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
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  placeholder = "Message",
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
