import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Linking,
} from "react-native";
import Markdown from "react-native-markdown-display";
import type {
  UIMessage,
  MessagePart,
  TextPart,
  ReasoningPart,
  FilePart,
  ToolInvocationPart,
  SourcesPart,
} from "@ourin/shared/types";

interface MessageBubbleProps {
  message: UIMessage;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <View style={[styles.container, isUser && styles.userContainer]}>
      {message.parts.map((part, index) => (
        <PartRenderer
          key={index}
          part={part}
          isUser={isUser}
          isStreaming={isStreaming && index === message.parts.length - 1}
        />
      ))}
    </View>
  );
}

interface PartRendererProps {
  part: MessagePart;
  isUser: boolean;
  isStreaming?: boolean;
}

function PartRenderer({ part, isUser, isStreaming }: PartRendererProps) {
  switch (part.type) {
    case "text":
      return (
        <TextPartView part={part} isUser={isUser} isStreaming={isStreaming} />
      );
    case "reasoning":
      return <ReasoningPartView part={part} />;
    case "file":
      return <FilePartView part={part} />;
    case "tool-invocation":
      return <ToolPartView part={part} />;
    case "sources":
      return <SourcesPartView part={part} />;
    default:
      return null;
  }
}

// Text part with markdown rendering
function TextPartView({
  part,
  isUser,
  isStreaming,
}: {
  part: TextPart;
  isUser: boolean;
  isStreaming?: boolean;
}) {
  if (!part.text) return null;

  return (
    <View style={[styles.textContainer, isUser && styles.userTextContainer]}>
      <Markdown
        style={isUser ? userMarkdownStyles : assistantMarkdownStyles}
        mergeStyle
      >
        {part.text + (isStreaming ? "\u258C" : "")}
      </Markdown>
    </View>
  );
}

// Reasoning/thinking block
function ReasoningPartView({ part }: { part: ReasoningPart }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable
      style={styles.reasoningContainer}
      onPress={() => setExpanded(!expanded)}
    >
      <View style={styles.reasoningHeader}>
        <Text style={styles.reasoningIcon}>
          {expanded ? "\u25BC" : "\u25B6"}
        </Text>
        <Text style={styles.reasoningTitle}>Thinking</Text>
        {part.duration && (
          <Text style={styles.reasoningDuration}>{part.duration}s</Text>
        )}
      </View>
      {expanded && (
        <View style={styles.reasoningContent}>
          <Text style={styles.reasoningText}>{part.text}</Text>
        </View>
      )}
    </Pressable>
  );
}

// File attachment
function FilePartView({ part }: { part: FilePart }) {
  const isImage = part.mediaType.startsWith("image/");

  if (isImage && part.url) {
    return (
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: part.url }}
          style={styles.image}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View style={styles.fileContainer}>
      <Text style={styles.fileIcon}>
        {part.mediaType.includes("pdf") ? "\uD83D\uDCDC" : "\uD83D\uDCC4"}
      </Text>
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>
          {part.fileName}
        </Text>
        {part.fileSize && (
          <Text style={styles.fileSize}>{formatFileSize(part.fileSize)}</Text>
        )}
      </View>
    </View>
  );
}

// Tool invocation
function ToolPartView({ part }: { part: ToolInvocationPart }) {
  const isComplete = part.state === "result";

  return (
    <View style={styles.toolContainer}>
      <View style={styles.toolHeader}>
        <Text style={styles.toolIcon}>{isComplete ? "\u2705" : "\u23F3"}</Text>
        <Text style={styles.toolName}>{part.toolName}</Text>
      </View>
    </View>
  );
}

// Web search sources
function SourcesPartView({ part }: { part: SourcesPart }) {
  return (
    <View style={styles.sourcesContainer}>
      <Text style={styles.sourcesTitle}>Sources</Text>
      {part.sources.map((source, index) => (
        <Pressable
          key={index}
          style={styles.sourceItem}
          onPress={() => Linking.openURL(source.url)}
        >
          <Text style={styles.sourceTitle} numberOfLines={1}>
            {source.title}
          </Text>
          <Text style={styles.sourceUrl} numberOfLines={1}>
            {new URL(source.url).hostname}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    marginHorizontal: 16,
    maxWidth: "85%",
    alignSelf: "flex-start",
  },
  userContainer: {
    alignSelf: "flex-end",
  },
  textContainer: {
    backgroundColor: "#2a2a2a",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userTextContainer: {
    backgroundColor: "#d97756",
  },
  reasoningContainer: {
    backgroundColor: "#1f1f1f",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#6b7280",
  },
  reasoningHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reasoningIcon: {
    color: "#9ca3af",
    fontSize: 10,
  },
  reasoningTitle: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "500",
  },
  reasoningDuration: {
    color: "#6b7280",
    fontSize: 12,
    marginLeft: "auto",
  },
  reasoningContent: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  reasoningText: {
    color: "#a1a1aa",
    fontSize: 13,
    lineHeight: 18,
  },
  imageContainer: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  fileContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 8,
  },
  fileIcon: {
    fontSize: 24,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    color: "#f5f5f4",
    fontSize: 14,
    fontWeight: "500",
  },
  fileSize: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 2,
  },
  toolContainer: {
    backgroundColor: "#1f1f1f",
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  toolHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toolIcon: {
    fontSize: 14,
  },
  toolName: {
    color: "#9ca3af",
    fontSize: 13,
  },
  sourcesContainer: {
    backgroundColor: "#1f1f1f",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  sourcesTitle: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sourceItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  sourceTitle: {
    color: "#60a5fa",
    fontSize: 14,
    marginBottom: 2,
  },
  sourceUrl: {
    color: "#6b7280",
    fontSize: 12,
  },
});

const assistantMarkdownStyles = StyleSheet.create({
  body: {
    color: "#f5f5f4",
    fontSize: 15,
    lineHeight: 22,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 8,
  },
  heading1: {
    color: "#f5f5f4",
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  heading2: {
    color: "#f5f5f4",
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 12,
    marginBottom: 6,
  },
  heading3: {
    color: "#f5f5f4",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 10,
    marginBottom: 4,
  },
  code_inline: {
    backgroundColor: "#3a3a3a",
    color: "#e0e0e0",
    fontFamily: "monospace",
    fontSize: 13,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  code_block: {
    backgroundColor: "#1a1a1a",
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  fence: {
    backgroundColor: "#1a1a1a",
    color: "#e0e0e0",
    fontFamily: "monospace",
    fontSize: 13,
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  blockquote: {
    backgroundColor: "#262626",
    borderLeftWidth: 3,
    borderLeftColor: "#d97756",
    paddingLeft: 12,
    marginVertical: 8,
  },
  list_item: {
    marginVertical: 2,
  },
  bullet_list: {
    marginVertical: 8,
  },
  ordered_list: {
    marginVertical: 8,
  },
  link: {
    color: "#60a5fa",
  },
  strong: {
    fontWeight: "bold",
  },
  em: {
    fontStyle: "italic",
  },
});

const userMarkdownStyles = StyleSheet.create({
  body: {
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 22,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 0,
  },
  code_inline: {
    backgroundColor: "rgba(0,0,0,0.2)",
    color: "#ffffff",
    fontFamily: "monospace",
    fontSize: 13,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fence: {
    backgroundColor: "rgba(0,0,0,0.2)",
    color: "#ffffff",
    fontFamily: "monospace",
    fontSize: 13,
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  link: {
    color: "#ffffff",
    textDecorationLine: "underline",
  },
  strong: {
    fontWeight: "bold",
  },
  em: {
    fontStyle: "italic",
  },
});
