import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
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
      <View style={styles.container}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={styles.backdropPressable} onPress={onClose} />
        </Animated.View>

        {/* Sidebar */}
        <Animated.View
          style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Ourin</Text>
            <Pressable style={styles.newChatButton} onPress={handleNewChat}>
              <Ionicons name="add-circle" size={28} color="#d97756" />
            </Pressable>
          </View>

          {/* Conversations List */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recents</Text>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#d97756" />
            </View>
          ) : (
            <ScrollView
              style={styles.conversationsList}
              showsVerticalScrollIndicator={false}
            >
              {conversations && conversations.length > 0 ? (
                conversations.map((conv) => {
                  const isActive = conv._id === currentConversationId;
                  return (
                    <Pressable
                      key={conv._id}
                      style={[
                        styles.conversationItem,
                        isActive && styles.conversationItemActive,
                      ]}
                      onPress={() => handleSelectConversation(conv._id)}
                      onLongPress={() => handleDeleteConversation(conv._id)}
                      delayLongPress={500}
                    >
                      <Text
                        style={[
                          styles.conversationTitle,
                          isActive && styles.conversationTitleActive,
                        ]}
                        numberOfLines={1}
                      >
                        {conv.title || "New Chat"}
                      </Text>
                      <Text style={styles.conversationTime}>
                        {formatRelativeTime(conv.updatedAt)}
                      </Text>
                    </Pressable>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>No conversations yet</Text>
              )}
            </ScrollView>
          )}

          {/* Footer - Settings */}
          <View style={styles.footer}>
            <Pressable style={styles.settingsButton} onPress={handleSettings}>
              <Ionicons name="settings-outline" size={22} color="#9ca3af" />
              <Text style={styles.settingsText}>Settings</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  backdropPressable: {
    flex: 1,
  },
  sidebar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: "#1a1a1a",
    borderRightWidth: 1,
    borderRightColor: "#333",
    paddingTop: 60,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f5f5f4",
  },
  newChatButton: {
    padding: 4,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  loadingContainer: {
    padding: 20,
    alignItems: "center",
  },
  conversationsList: {
    flex: 1,
    paddingHorizontal: 12,
  },
  conversationItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 2,
  },
  conversationItemActive: {
    backgroundColor: "rgba(217, 119, 86, 0.15)",
  },
  conversationTitle: {
    fontSize: 15,
    color: "#f5f5f4",
    marginBottom: 2,
  },
  conversationTitleActive: {
    color: "#d97756",
  },
  conversationTime: {
    fontSize: 12,
    color: "#6b7280",
  },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    paddingVertical: 20,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#333",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  settingsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  settingsText: {
    fontSize: 16,
    color: "#9ca3af",
  },
});
