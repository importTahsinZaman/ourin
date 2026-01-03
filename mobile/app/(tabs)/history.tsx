import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
} from "react-native";

// Placeholder data - will be replaced with Convex query
const PLACEHOLDER_CONVERSATIONS = [
  { id: "1", title: "About Ourin", updatedAt: "3 days ago" },
  { id: "2", title: "React Native performance tips", updatedAt: "1 week ago" },
  { id: "3", title: "Building a chat app", updatedAt: "2 weeks ago" },
];

export default function HistoryScreen() {
  const conversations = PLACEHOLDER_CONVERSATIONS;

  const renderConversation = ({
    item,
  }: {
    item: (typeof PLACEHOLDER_CONVERSATIONS)[0];
  }) => (
    <Pressable style={styles.conversationItem}>
      <View style={styles.conversationContent}>
        <Text style={styles.conversationTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.conversationTime}>{item.updatedAt}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor="#666"
          />
        </View>
      </View>

      {conversations.length > 0 ? (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyText}>
            Start chatting to see your conversations here
          </Text>
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
    fontSize: 14,
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
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  conversationContent: {
    flex: 1,
  },
  conversationTitle: {
    fontSize: 16,
    color: "#f5f5f4",
    marginBottom: 4,
  },
  conversationTime: {
    fontSize: 13,
    color: "#666",
  },
  chevron: {
    fontSize: 20,
    color: "#666",
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#f5f5f4",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
});
