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
  const initialScrollDone = useRef(false);
  const prevMessageCount = useRef(messages.length);

  // Scroll to bottom - instant on initial load, animated for new messages
  useEffect(() => {
    if (messages.length > 0) {
      const isInitialLoad = !initialScrollDone.current;
      const isNewMessage = messages.length > prevMessageCount.current;

      if (isInitialLoad) {
        // Instant scroll on initial load
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
          initialScrollDone.current = true;
        }, 50);
      } else if (isNewMessage || isStreaming) {
        // Animated scroll for new messages
        flatListRef.current?.scrollToEnd({ animated: true });
      }

      prevMessageCount.current = messages.length;
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
