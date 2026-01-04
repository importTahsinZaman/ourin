import React, { useState, useMemo } from "react";
import { View, Text, Pressable, Image, Linking } from "react-native";
import Markdown from "react-native-markdown-display";
import { useTheme, type DerivedColors } from "@/providers/ThemeProvider";
import type {
  UIMessage,
  MessagePart,
  TextPart,
  ReasoningPart,
  FilePart,
  ToolInvocationPart,
  SourcesPart,
} from "@ourin/shared/types";
import { StepsAccordion } from "./StepsAccordion";

interface MessageBubbleProps {
  message: UIMessage;
  isStreaming?: boolean;
}

// Chunk type for grouping parts
type Chunk =
  | { type: "steps"; parts: MessagePart[] }
  | { type: "single"; part: MessagePart };

// Check if a part should be grouped into steps accordion
function isStepPart(part: MessagePart): boolean {
  if (part.type === "reasoning") return true;
  if (part.type === "tool-invocation") {
    return (part as ToolInvocationPart).toolName
      .toLowerCase()
      .includes("search");
  }
  return false;
}

// Group consecutive step parts together
function chunkParts(parts: MessagePart[]): Chunk[] {
  const chunks: Chunk[] = [];
  let currentStepParts: MessagePart[] = [];

  for (const part of parts) {
    if (isStepPart(part)) {
      currentStepParts.push(part);
    } else {
      // Flush any accumulated step parts
      if (currentStepParts.length > 0) {
        chunks.push({ type: "steps", parts: currentStepParts });
        currentStepParts = [];
      }
      chunks.push({ type: "single", part });
    }
  }

  // Flush remaining step parts
  if (currentStepParts.length > 0) {
    chunks.push({ type: "steps", parts: currentStepParts });
  }

  return chunks;
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const { colors } = useTheme();
  const isUser = message.role === "user";

  // Chunk parts to group steps together
  const chunks = useMemo(() => chunkParts(message.parts), [message.parts]);

  // Check if actively thinking (last chunk is steps and streaming)
  const lastChunk = chunks[chunks.length - 1];
  const isActivelyThinking =
    isStreaming &&
    lastChunk?.type === "steps" &&
    !message.parts.some((p) => p.type === "text" && (p as TextPart).text);

  return (
    <View
      style={{
        marginVertical: 8,
        // User messages: bubble with margin, Assistant: full width with padding
        marginHorizontal: isUser ? 16 : 0,
        paddingHorizontal: isUser ? 0 : 16,
        maxWidth: isUser ? "85%" : undefined,
        alignSelf: isUser ? "flex-end" : "stretch",
      }}
    >
      {chunks.map((chunk, index) => {
        if (chunk.type === "steps") {
          const isLastChunk = index === chunks.length - 1;
          return (
            <StepsAccordion
              key={`steps-${index}`}
              parts={chunk.parts}
              isStreaming={isStreaming && isLastChunk}
              isActivelyThinking={isActivelyThinking && isLastChunk}
              colors={colors}
            />
          );
        } else {
          return (
            <PartRenderer
              key={`part-${index}`}
              part={chunk.part}
              isUser={isUser}
              isStreaming={isStreaming && index === chunks.length - 1}
              colors={colors}
            />
          );
        }
      })}
    </View>
  );
}

interface PartRendererProps {
  part: MessagePart;
  isUser: boolean;
  isStreaming?: boolean;
  colors: DerivedColors;
}

function PartRenderer({
  part,
  isUser,
  isStreaming,
  colors,
}: PartRendererProps) {
  switch (part.type) {
    case "text":
      return (
        <TextPartView
          part={part}
          isUser={isUser}
          isStreaming={isStreaming}
          colors={colors}
        />
      );
    case "reasoning":
      return <ReasoningPartView part={part} colors={colors} />;
    case "file":
      return <FilePartView part={part} colors={colors} />;
    case "tool-invocation":
      return <ToolPartView part={part} colors={colors} />;
    case "sources":
      return <SourcesPartView part={part} colors={colors} />;
    default:
      return null;
  }
}

// Text part with markdown rendering
function TextPartView({
  part,
  isUser,
  isStreaming,
  colors,
}: {
  part: TextPart;
  isUser: boolean;
  isStreaming?: boolean;
  colors: DerivedColors;
}) {
  const assistantMarkdownStyles = useMemo(
    () => ({
      body: {
        color: colors.text,
        fontSize: 17,
        lineHeight: 26,
      },
      paragraph: {
        marginTop: 0,
        marginBottom: 12,
      },
      heading1: {
        color: colors.text,
        fontSize: 26,
        fontWeight: "700" as const,
        marginTop: 24,
        marginBottom: 12,
        lineHeight: 32,
      },
      heading2: {
        color: colors.text,
        fontSize: 22,
        fontWeight: "700" as const,
        marginTop: 20,
        marginBottom: 10,
        lineHeight: 28,
      },
      heading3: {
        color: colors.text,
        fontSize: 19,
        fontWeight: "600" as const,
        marginTop: 16,
        marginBottom: 8,
        lineHeight: 24,
      },
      code_inline: {
        backgroundColor: colors.backgroundTertiary,
        color: colors.textSecondary,
        fontFamily: "monospace",
        fontSize: 15,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
      },
      code_block: {
        backgroundColor: colors.background,
        padding: 14,
        borderRadius: 10,
        marginVertical: 12,
      },
      fence: {
        backgroundColor: colors.background,
        color: colors.textSecondary,
        fontFamily: "monospace",
        fontSize: 14,
        padding: 14,
        borderRadius: 10,
        marginVertical: 12,
      },
      blockquote: {
        backgroundColor: colors.backgroundSecondary,
        borderLeftWidth: 3,
        borderLeftColor: colors.accent,
        paddingLeft: 14,
        marginVertical: 12,
      },
      list_item: {
        marginVertical: 4,
      },
      bullet_list: {
        marginVertical: 12,
      },
      ordered_list: {
        marginVertical: 12,
      },
      link: {
        color: "#60a5fa",
      },
      strong: {
        fontWeight: "700" as const,
      },
      em: {
        fontStyle: "italic" as const,
      },
    }),
    [colors]
  );

  const userMarkdownStyles = useMemo(
    () => ({
      body: {
        color: "#ffffff",
        fontSize: 17,
        lineHeight: 26,
      },
      paragraph: {
        marginTop: 0,
        marginBottom: 0,
      },
      code_inline: {
        backgroundColor: "rgba(0,0,0,0.2)",
        color: "#ffffff",
        fontFamily: "monospace",
        fontSize: 15,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
      },
      fence: {
        backgroundColor: "rgba(0,0,0,0.2)",
        color: "#ffffff",
        fontFamily: "monospace",
        fontSize: 14,
        padding: 14,
        borderRadius: 10,
        marginVertical: 8,
      },
      link: {
        color: "#ffffff",
        textDecorationLine: "underline" as const,
      },
      strong: {
        fontWeight: "700" as const,
      },
      em: {
        fontStyle: "italic" as const,
      },
    }),
    []
  );

  if (!part.text) return null;

  // User messages get bubble styling, assistant messages are plain full-width
  if (isUser) {
    return (
      <View
        style={{
          backgroundColor: colors.accent,
          borderRadius: 16,
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}
      >
        <Markdown style={userMarkdownStyles} mergeStyle>
          {part.text}
        </Markdown>
      </View>
    );
  }

  // Assistant message - no bubble, full width
  return (
    <View style={{ paddingVertical: 4 }}>
      <Markdown style={assistantMarkdownStyles} mergeStyle>
        {part.text + (isStreaming ? "\u258C" : "")}
      </Markdown>
    </View>
  );
}

// Reasoning/thinking block
function ReasoningPartView({
  part,
  colors,
}: {
  part: ReasoningPart;
  colors: DerivedColors;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable
      style={{
        backgroundColor: colors.background,
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderLeftWidth: 3,
        borderLeftColor: colors.textMuted,
      }}
      onPress={() => setExpanded(!expanded)}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ color: colors.textMuted, fontSize: 10 }}>
          {expanded ? "\u25BC" : "\u25B6"}
        </Text>
        <Text
          style={{ color: colors.textMuted, fontSize: 13, fontWeight: "500" }}
        >
          Thinking
        </Text>
        {part.duration && (
          <Text
            style={{
              color: colors.textTertiary,
              fontSize: 12,
              marginLeft: "auto",
            }}
          >
            {part.duration}s
          </Text>
        )}
      </View>
      {expanded && (
        <View
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 13,
              lineHeight: 18,
            }}
          >
            {part.text}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// File attachment
function FilePartView({
  part,
  colors,
}: {
  part: FilePart;
  colors: DerivedColors;
}) {
  const isImage = part.mediaType.startsWith("image/");

  if (isImage && part.url) {
    return (
      <View style={{ borderRadius: 12, overflow: "hidden", marginBottom: 8 }}>
        <Image
          source={{ uri: part.url }}
          style={{ width: 200, height: 200, borderRadius: 12 }}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 12,
        padding: 12,
        gap: 10,
        marginBottom: 8,
      }}
    >
      <Text style={{ fontSize: 24 }}>
        {part.mediaType.includes("pdf") ? "\uD83D\uDCDC" : "\uD83D\uDCC4"}
      </Text>
      <View style={{ flex: 1 }}>
        <Text
          style={{ color: colors.text, fontSize: 14, fontWeight: "500" }}
          numberOfLines={1}
        >
          {part.fileName}
        </Text>
        {part.fileSize && (
          <Text
            style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}
          >
            {formatFileSize(part.fileSize)}
          </Text>
        )}
      </View>
    </View>
  );
}

// Tool invocation
function ToolPartView({
  part,
  colors,
}: {
  part: ToolInvocationPart;
  colors: DerivedColors;
}) {
  const isComplete = part.state === "result";

  return (
    <View
      style={{
        backgroundColor: colors.background,
        borderRadius: 12,
        padding: 10,
        marginBottom: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ fontSize: 14 }}>{isComplete ? "\u2705" : "\u23F3"}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>
          {part.toolName}
        </Text>
      </View>
    </View>
  );
}

// Web search sources
function SourcesPartView({
  part,
  colors,
}: {
  part: SourcesPart;
  colors: DerivedColors;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.background,
        borderRadius: 12,
        padding: 12,
        marginTop: 8,
      }}
    >
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 12,
          fontWeight: "600",
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        Sources
      </Text>
      {part.sources.map((source, index) => (
        <Pressable
          key={index}
          style={{
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: colors.backgroundSecondary,
          }}
          onPress={() => Linking.openURL(source.url)}
        >
          <Text
            style={{ color: "#60a5fa", fontSize: 14, marginBottom: 2 }}
            numberOfLines={1}
          >
            {source.title}
          </Text>
          <Text
            style={{ color: colors.textTertiary, fontSize: 12 }}
            numberOfLines={1}
          >
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
