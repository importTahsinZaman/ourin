import "react-native-get-random-values";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ConvexProvider } from "@/providers/ConvexProvider";

export default function RootLayout() {
  return (
    <ConvexProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="c/[id]"
          options={{
            presentation: "modal",
            headerShown: true,
            headerTitle: "Chat",
          }}
        />
        <Stack.Screen
          name="(auth)"
          options={{
            presentation: "modal",
          }}
        />
      </Stack>
    </ConvexProvider>
  );
}
