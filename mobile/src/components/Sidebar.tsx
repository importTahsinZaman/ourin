import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  Animated,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/providers/ThemeProvider";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.8;

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
  currentConversationId?: string | null;
  onNewChat: () => void;
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
}: SidebarProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const conversations = useQuery(api.conversations.list);
  const removeConversation = useMutation(api.conversations.remove);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SIDEBAR_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

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
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, flexDirection: "row" }}>
        {/* Backdrop */}
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            opacity: fadeAnim,
          }}
        >
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        {/* Sidebar */}
        <Animated.View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: SIDEBAR_WIDTH,
            backgroundColor: colors.background,
            borderRightWidth: 1,
            borderRightColor: colors.border,
            paddingTop: 60,
            transform: [{ translateX: slideAnim }],
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 20,
              paddingBottom: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 24,
                fontWeight: "700",
                color: colors.text,
              }}
            >
              Ourin
            </Text>
            <Pressable style={{ padding: 4 }} onPress={handleNewChat}>
              <Ionicons name="add-circle" size={28} color={colors.accent} />
            </Pressable>
          </View>

          {/* Conversations List */}
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 20,
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
                        paddingVertical: 12,
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
                          fontSize: 15,
                          color: isActive ? colors.accent : colors.text,
                          marginBottom: 2,
                        }}
                        numberOfLines={1}
                      >
                        {conv.title || "New Chat"}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: colors.textMuted,
                        }}
                      >
                        {formatRelativeTime(conv.updatedAt)}
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
              borderTopWidth: 1,
              borderTopColor: colors.border,
              paddingHorizontal: 20,
              paddingVertical: 16,
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
              <Ionicons
                name="settings-outline"
                size={22}
                color={colors.textSecondary}
              />
              <Text
                style={{
                  fontSize: 16,
                  color: colors.textSecondary,
                }}
              >
                Settings
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
