import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Keyboard,
  Image,
  ScrollView,
  Platform,
  ActivityIndicator,
  type TextInput as TextInputType,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { type PendingFile } from "@/hooks/useFileAttachment";
import { useTheme, type DerivedColors } from "@/providers/ThemeProvider";
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
  webSearchEnabled?: boolean;
  // File attachment
  pendingFiles: PendingFile[];
  isUploading: boolean;
  hasFiles: boolean;
  onRemoveFile: (id: string) => void;
  getFileParts: () => FilePart[];
  clearFiles: () => void;
  // Add to chat modal
  onOpenAddToChat: () => void;
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  placeholder = "Message",
  webSearchEnabled = false,
  pendingFiles,
  isUploading,
  hasFiles,
  onRemoveFile,
  getFileParts,
  clearFiles,
  onOpenAddToChat,
}: ChatInputProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const inputRef = useRef<TextInputType>(null);

  // Dismiss keyboard on mount
  useEffect(() => {
    Keyboard.dismiss();
  }, []);

  // Track keyboard height
  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

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

  const handleStop = () => {
    onStop?.();
  };

  const canSend =
    (text.trim().length > 0 || hasFiles) && !isStreaming && !isUploading;

  return (
    <View
      style={{
        position: "absolute",
        bottom: keyboardHeight,
        left: 0,
        right: 0,
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: keyboardHeight > 0 ? 12 : insets.bottom + 12,
      }}
    >
      {/* File previews */}
      {pendingFiles.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 8, maxHeight: 100 }}
          contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
        >
          {pendingFiles.map((file) => (
            <FilePreview
              key={file.id}
              file={file}
              onRemove={() => onRemoveFile(file.id)}
              colors={colors}
            />
          ))}
        </ScrollView>
      )}

      <View
        style={{
          backgroundColor: colors.backgroundSecondary,
          borderRadius: 24,
          paddingHorizontal: 14,
          paddingTop: 12,
          paddingBottom: 10,
          minHeight: 56,
          // Floating shadow
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <TextInput
          ref={inputRef}
          style={{
            fontSize: 16,
            color: colors.text,
            maxHeight: 120,
            paddingHorizontal: 2,
          }}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={32000}
          editable={!isStreaming}
          autoFocus={false}
        />
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 8,
          }}
        >
          {/* Add to chat button */}
          <Pressable
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              justifyContent: "center",
              alignItems: "center",
            }}
            onPress={onOpenAddToChat}
            disabled={isStreaming}
          >
            <Ionicons
              name="add"
              size={22}
              color={isStreaming ? colors.textTertiary : colors.textMuted}
            />
          </Pressable>

          {/* Send/Stop button */}
          {isStreaming ? (
            <Pressable
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: colors.error,
                justifyContent: "center",
                alignItems: "center",
              }}
              onPress={handleStop}
            >
              <Ionicons name="stop" size={18} color="#fff" />
            </Pressable>
          ) : isUploading ? (
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: colors.backgroundTertiary,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <ActivityIndicator size="small" color={colors.textMuted} />
            </View>
          ) : (
            <Pressable
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: canSend
                  ? colors.accent
                  : colors.backgroundTertiary,
                justifyContent: "center",
                alignItems: "center",
              }}
              onPress={handleSend}
              disabled={!canSend}
            >
              <Ionicons
                name="arrow-up"
                size={18}
                color={canSend ? "#fff" : colors.textMuted}
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
  colors: DerivedColors;
}

function FilePreview({ file, onRemove, colors }: FilePreviewProps) {
  const isImage = file.mimeType.startsWith("image/");

  return (
    <View style={{ width: 72, alignItems: "center" }}>
      {isImage ? (
        <Image
          source={{ uri: file.uri }}
          style={{
            width: 64,
            height: 64,
            borderRadius: 8,
            backgroundColor: colors.backgroundTertiary,
          }}
        />
      ) : (
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 8,
            backgroundColor: colors.backgroundTertiary,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons
            name="document-outline"
            size={24}
            color={colors.textMuted}
          />
        </View>
      )}

      {/* Uploading overlay */}
      {file.isUploading && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 4,
            width: 64,
            height: 64,
            borderRadius: 8,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <ActivityIndicator size="small" color="#fff" />
        </View>
      )}

      {/* Error overlay */}
      {file.error && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 4,
            width: 64,
            height: 64,
            borderRadius: 8,
            backgroundColor: "rgba(239, 68, 68, 0.7)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons name="alert-circle" size={20} color="#fff" />
        </View>
      )}

      {/* Remove button */}
      <Pressable
        style={{
          position: "absolute",
          top: -4,
          right: 0,
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: colors.textMuted,
          justifyContent: "center",
          alignItems: "center",
        }}
        onPress={onRemove}
      >
        <Ionicons name="close" size={14} color="#fff" />
      </Pressable>

      {/* File name */}
      <Text
        style={{
          fontSize: 10,
          color: colors.textMuted,
          marginTop: 4,
          textAlign: "center",
          width: 64,
        }}
        numberOfLines={1}
      >
        {file.fileName}
      </Text>
    </View>
  );
}
