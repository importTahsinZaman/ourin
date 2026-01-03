import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  RefreshControl,
  Alert,
  ActivityIndicator,
  ActionSheetIOS,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";

type Conversation = Doc<"conversations">;

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (months > 0) return `${months} month${months > 1 ? "s" : ""} ago`;
  if (weeks > 0) return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  return "Just now";
}

export default function HistoryScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const conversations = useQuery(api.conversations.list);
  const removeConversation = useMutation(api.conversations.remove);

  const isLoading = conversations === undefined;

  // Filter conversations based on search query
  const filteredConversations = conversations?.filter((conv) => {
    if (!searchQuery.trim()) return true;
    const title = conv.title || "New Chat";
    return title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Convex automatically refreshes, we just need to show the indicator briefly
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const handleDelete = useCallback(
    async (id: Id<"conversations">) => {
      Alert.alert(
        "Delete Conversation",
        "Are you sure you want to delete this conversation? This action cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await removeConversation({ id });
              } catch {
                Alert.alert("Error", "Failed to delete conversation");
              }
            },
          },
        ]
      );
    },
    [removeConversation]
  );

  const handlePress = useCallback(
    (id: string) => {
      // Navigate to Chat tab with the conversation ID
      router.replace({
        pathname: "/(tabs)",
        params: { conversationId: id },
      });
    },
    [router]
  );

  const handleLongPress = useCallback(
    (item: Conversation) => {
      const options = ["Delete", "Cancel"];
      const destructiveIndex = 0;
      const cancelIndex = 1;

      if (Platform.OS === "ios") {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options,
            destructiveButtonIndex: destructiveIndex,
            cancelButtonIndex: cancelIndex,
            title: item.title || "New Chat",
          },
          (buttonIndex) => {
            if (buttonIndex === destructiveIndex) {
              handleDelete(item._id);
            }
          }
        );
      } else {
        // Android fallback using Alert
        handleDelete(item._id);
      }
    },
    [handleDelete]
  );

  const renderConversation = useCallback(
    ({ item }: { item: Conversation }) => (
      <Pressable
        style={styles.conversationItem}
        onPress={() => handlePress(item._id)}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={500}
      >
        <View style={styles.conversationContent}>
          <View style={styles.titleRow}>
            {item.isFavorite && (
              <Ionicons
                name="star"
                size={14}
                color="#d97756"
                style={styles.favoriteIcon}
              />
            )}
            <Text style={styles.conversationTitle} numberOfLines={1}>
              {item.title || "New Chat"}
            </Text>
          </View>
          <Text style={styles.conversationTime}>
            {formatRelativeTime(item.updatedAt)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#666" />
      </Pressable>
    ),
    [handlePress, handleLongPress]
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons
            name="search"
            size={16}
            color="#666"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations"
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color="#666" />
            </Pressable>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#d97756" />
        </View>
      ) : filteredConversations && filteredConversations.length > 0 ? (
        <FlatList
          data={filteredConversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#d97756"
              colors={["#d97756"]}
            />
          }
        />
      ) : (
        <View style={styles.emptyState}>
          {searchQuery ? (
            <>
              <Ionicons name="search" size={48} color="#444" />
              <Text style={styles.emptyTitle}>No results found</Text>
              <Text style={styles.emptyText}>Try a different search term</Text>
            </>
          ) : (
            <>
              <Ionicons name="chatbubbles-outline" size={48} color="#444" />
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptyText}>
                Start chatting to see your conversations here
              </Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#262626",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#f5f5f4",
  },
  listContent: {
    paddingHorizontal: 16,
  },
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
    backgroundColor: "#1a1a1a",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  conversationContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  favoriteIcon: {
    marginRight: 6,
  },
  conversationTitle: {
    fontSize: 16,
    color: "#f5f5f4",
    flex: 1,
  },
  conversationTime: {
    fontSize: 13,
    color: "#666",
  },
  loadingState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#f5f5f4",
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
});
