import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Keyboard,
  Image,
  ScrollView,
  ActionSheetIOS,
  Platform,
  Alert,
  ActivityIndicator,
  type TextInput as TextInputType,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFileAttachment, type PendingFile } from "@/hooks/useFileAttachment";
import type { FilePart } from "@ourin/shared/types";

interface ChatInputProps {
  onSend: (
    text: string,
    files?: FilePart[],
    options?: { webSearchEnabled?: boolean }
  ) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  placeholder?: string;
  modelName?: string;
  activeCoresCount?: number;
  onOpenModelPicker?: () => void;
  onOpenCorePicker?: () => void;
  // Web search
  webSearchEnabled?: boolean;
  onWebSearchToggle?: (enabled: boolean) => void;
  modelSupportsWebSearch?: boolean;
  // Reasoning
  reasoningLevel?: string | number;
  onOpenReasoningPicker?: () => void;
  modelSupportsReasoning?: boolean;
  reasoningLabel?: string;
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
  webSearchEnabled = false,
  onWebSearchToggle,
  modelSupportsWebSearch = false,
  reasoningLevel,
  onOpenReasoningPicker,
  modelSupportsReasoning = false,
  reasoningLabel,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<TextInputType>(null);

  const {
    pendingFiles,
    isUploading,
    hasFiles,
    takePhoto,
    pickImage,
    pickDocument,
    removeFile,
    clearFiles,
    getFileParts,
  } = useFileAttachment();

  const handleSend = () => {
    const trimmed = text.trim();
    const fileParts = getFileParts();

    if (!trimmed && fileParts.length === 0) return;

    onSend(
      trimmed,
      fileParts.length > 0 ? fileParts : undefined,
      webSearchEnabled ? { webSearchEnabled: true } : undefined
    );
    setText("");
    clearFiles();
    Keyboard.dismiss();
  };

  const isReasoningOff = reasoningLevel === "off";

  const handleStop = () => {
    onStop?.();
  };

  const showAttachmentOptions = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            "Cancel",
            "Take Photo",
            "Choose from Library",
            "Choose Document",
          ],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          switch (buttonIndex) {
            case 1:
              takePhoto();
              break;
            case 2:
              pickImage();
              break;
            case 3:
              pickDocument();
              break;
          }
        }
      );
    } else {
      // Android fallback
      Alert.alert("Add Attachment", "Choose an option", [
        { text: "Cancel", style: "cancel" },
        { text: "Take Photo", onPress: takePhoto },
        { text: "Choose from Library", onPress: pickImage },
        { text: "Choose Document", onPress: pickDocument },
      ]);
    }
  };

  const canSend =
    (text.trim().length > 0 || hasFiles) && !isStreaming && !isUploading;

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

      {/* File previews */}
      {pendingFiles.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filePreviewContainer}
          contentContainerStyle={styles.filePreviewContent}
        >
          {pendingFiles.map((file) => (
            <FilePreview
              key={file.id}
              file={file}
              onRemove={() => removeFile(file.id)}
            />
          ))}
        </ScrollView>
      )}

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
          {/* Left side buttons */}
          <View style={styles.leftButtons}>
            {/* Attachment button */}
            <Pressable
              style={styles.iconButton}
              onPress={showAttachmentOptions}
              disabled={isStreaming}
            >
              <Ionicons
                name="add"
                size={22}
                color={isStreaming ? "#555" : "#6b7280"}
              />
            </Pressable>

            {/* Reasoning button - only show for reasoning models */}
            {modelSupportsReasoning && onOpenReasoningPicker && (
              <Pressable
                style={styles.iconButton}
                onPress={onOpenReasoningPicker}
              >
                <Ionicons
                  name="bulb-outline"
                  size={20}
                  color={isReasoningOff ? "#6b7280" : "#d97756"}
                />
              </Pressable>
            )}

            {/* Web search toggle - only show for models that support it */}
            {modelSupportsWebSearch && onWebSearchToggle && (
              <Pressable
                style={styles.iconButton}
                onPress={() => onWebSearchToggle(!webSearchEnabled)}
              >
                <Ionicons
                  name="globe-outline"
                  size={20}
                  color={webSearchEnabled ? "#d97756" : "#6b7280"}
                />
              </Pressable>
            )}
          </View>

          {/* Send/Stop button */}
          {isStreaming ? (
            <Pressable
              style={[styles.sendButton, styles.stopButton]}
              onPress={handleStop}
            >
              <Ionicons name="stop" size={18} color="#fff" />
            </Pressable>
          ) : isUploading ? (
            <View style={[styles.sendButton, styles.sendButtonDisabled]}>
              <ActivityIndicator size="small" color="#666" />
            </View>
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

interface FilePreviewProps {
  file: PendingFile;
  onRemove: () => void;
}

function FilePreview({ file, onRemove }: FilePreviewProps) {
  const isImage = file.mimeType.startsWith("image/");

  return (
    <View style={styles.filePreview}>
      {isImage ? (
        <Image source={{ uri: file.uri }} style={styles.filePreviewImage} />
      ) : (
        <View style={styles.filePreviewDoc}>
          <Ionicons name="document-outline" size={24} color="#9ca3af" />
        </View>
      )}

      {/* Uploading overlay */}
      {file.isUploading && (
        <View style={styles.filePreviewOverlay}>
          <ActivityIndicator size="small" color="#fff" />
        </View>
      )}

      {/* Error overlay */}
      {file.error && (
        <View style={[styles.filePreviewOverlay, styles.filePreviewError]}>
          <Ionicons name="alert-circle" size={20} color="#fff" />
        </View>
      )}

      {/* Remove button */}
      <Pressable style={styles.fileRemoveButton} onPress={onRemove}>
        <Ionicons name="close" size={14} color="#fff" />
      </Pressable>

      {/* File name */}
      <Text style={styles.fileName} numberOfLines={1}>
        {file.fileName}
      </Text>
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
  filePreviewContainer: {
    marginBottom: 8,
    maxHeight: 100,
  },
  filePreviewContent: {
    gap: 8,
    paddingVertical: 4,
  },
  filePreview: {
    width: 72,
    alignItems: "center",
  },
  filePreviewImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: "#333",
  },
  filePreviewDoc: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  filePreviewOverlay: {
    position: "absolute",
    top: 0,
    left: 4,
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  filePreviewError: {
    backgroundColor: "rgba(239, 68, 68, 0.7)",
  },
  fileRemoveButton: {
    position: "absolute",
    top: -4,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#666",
    justifyContent: "center",
    alignItems: "center",
  },
  fileName: {
    fontSize: 10,
    color: "#9ca3af",
    marginTop: 4,
    textAlign: "center",
    width: 64,
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
  leftButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
