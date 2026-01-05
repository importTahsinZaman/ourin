import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Animated,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/providers/ThemeProvider";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.78;

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
  currentConversationId?: string | null;
  onNewChat: () => void;
  children: React.ReactNode;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

export function Sidebar({
  visible,
  onClose,
  currentConversationId,
  onNewChat,
  children,
}: SidebarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  // Animation value: 0 = closed, 1 = open
  const animValue = useRef(new Animated.Value(0)).current;

  const conversations = useQuery(api.conversations.list);
  const removeConversation = useMutation(api.conversations.remove);

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: visible ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [visible, animValue]);

  // Interpolate sidebar position
  const sidebarTranslateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-SIDEBAR_WIDTH, 0],
  });

  // Interpolate main content position
  const contentTranslateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SIDEBAR_WIDTH],
  });

  // Backdrop opacity
  const backdropOpacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.3],
  });

  const handleSelectConversation = (id: string) => {
    onClose();
    router.replace({
      pathname: "/(tabs)",
      params: { conversationId: id },
    });
  };

  const handleNewChat = () => {
    onClose();
    onNewChat();
  };

  const handleSettings = () => {
    onClose();
    router.push("/(tabs)/settings");
  };

  const handleDeleteConversation = async (id: Id<"conversations">) => {
    try {
      await removeConversation({ id });
    } catch {
      // Silently fail
    }
  };

  const isLoading = conversations === undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Sidebar */}
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: SIDEBAR_WIDTH,
          backgroundColor: colors.background,
          paddingTop: insets.top,
          zIndex: 100,
          transform: [{ translateX: sidebarTranslateX }],
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 16,
          }}
        >
          <Text
            style={{
              fontSize: 26,
              fontWeight: "700",
              color: colors.text,
            }}
          >
            Ourin
          </Text>
          <Pressable
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: colors.accent,
              justifyContent: "center",
              alignItems: "center",
            }}
            onPress={handleNewChat}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </Pressable>
        </View>

        {/* Conversations List */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 8,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: colors.textMuted,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Recents
          </Text>
        </View>

        {isLoading ? (
          <View style={{ padding: 20, alignItems: "center" }}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1, paddingHorizontal: 12 }}
            showsVerticalScrollIndicator={false}
          >
            {conversations && conversations.length > 0 ? (
              conversations.map((conv) => {
                const isActive = conv._id === currentConversationId;
                return (
                  <Pressable
                    key={conv._id}
                    style={{
                      paddingVertical: 14,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      marginBottom: 2,
                      backgroundColor: isActive
                        ? colors.accentMuted
                        : "transparent",
                    }}
                    onPress={() => handleSelectConversation(conv._id)}
                    onLongPress={() => handleDeleteConversation(conv._id)}
                    delayLongPress={500}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        color: isActive ? colors.accent : colors.text,
                      }}
                      numberOfLines={1}
                    >
                      {conv.title || "New Chat"}
                    </Text>
                  </Pressable>
                );
              })
            ) : (
              <Text
                style={{
                  fontSize: 14,
                  color: colors.textMuted,
                  textAlign: "center",
                  paddingVertical: 20,
                }}
              >
                No conversations yet
              </Text>
            )}
          </ScrollView>
        )}

        {/* Footer - Settings */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingVertical: 16,
            paddingBottom: insets.bottom + 16,
          }}
        >
          <Pressable
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 8,
            }}
            onPress={handleSettings}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: colors.backgroundSecondary,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="settings-outline" size={18} color={colors.text} />
            </View>
            <Text
              style={{
                fontSize: 16,
                color: colors.text,
              }}
            >
              Settings
            </Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* Main Content */}
      <Animated.View
        style={{
          flex: 1,
          transform: [{ translateX: contentTranslateX }],
        }}
      >
        {children}

        {/* Backdrop overlay on main content when sidebar open */}
        {visible && (
          <Animated.View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "#000",
              opacity: backdropOpacity,
            }}
          >
            <Pressable style={{ flex: 1 }} onPress={onClose} />
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}
