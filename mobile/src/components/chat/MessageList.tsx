import React, { useRef, useEffect } from "react";
import {
  FlatList,
  View,
  StyleSheet,
  type ListRenderItemInfo,
} from "react-native";
import type { UIMessage } from "@ourin/shared/types";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: UIMessage[];
  isStreaming?: boolean;
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
  const flatListRef = useRef<FlatList<UIMessage>>(null);

  // Scroll to bottom when new messages arrive or when streaming
  useEffect(() => {
    if (messages.length > 0) {
      // Small delay to ensure content has rendered
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, isStreaming]);

  const renderMessage = ({ item, index }: ListRenderItemInfo<UIMessage>) => (
    <MessageBubble
      message={item}
      isStreaming={isStreaming && index === messages.length - 1}
    />
  );

  const keyExtractor = (item: UIMessage) => item.id;

  return (
    <FlatList
      ref={flatListRef}
      data={messages}
      renderItem={renderMessage}
      keyExtractor={keyExtractor}
      style={styles.list}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      onContentSizeChange={() => {
        if (isStreaming) {
          flatListRef.current?.scrollToEnd({ animated: false });
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  content: {
    paddingTop: 16,
    paddingBottom: 160, // Space for floating input
  },
});
