import { useEffect } from "react";
import { Tabs } from "expo-router";
import { Text, View, ActivityIndicator, StyleSheet } from "react-native";
import { useAnonymousAuth } from "@/hooks";

export default function TabLayout() {
  const { ensureAuthenticated, isLoading } = useAnonymousAuth();

  // Auto sign-in with anonymous auth on mount
  useEffect(() => {
    ensureAuthenticated();
  }, [ensureAuthenticated]);

  // Show loading state while auth is initializing
  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#d97756" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#d97756",
        tabBarInactiveTintColor: "#666",
        tabBarStyle: {
          backgroundColor: "#1a1a1a",
          borderTopColor: "#333",
        },
        headerStyle: {
          backgroundColor: "#1a1a1a",
        },
        headerTintColor: "#f5f5f4",
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Chat",
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>💬</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>📋</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>⚙️</Text>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
  },
});
