import "react-native-get-random-values";
// TextDecoder polyfill for streaming
import "text-encoding";
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { useConvexAuth } from "convex/react";
import { ConvexProvider } from "@/providers/ConvexProvider";
import { ThemeProvider, useTheme } from "@/providers/ThemeProvider";

function RootLayoutNav() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { colors, theme, isLoading: themeLoading } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, authLoading, segments, router]);

  // Show loading while checking auth or loading theme
  if (authLoading || themeLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const statusBarStyle = theme.type === "dark" ? "light" : "dark";

  return (
    <>
      <StatusBar style={statusBarStyle} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="c/[id]"
          options={{
            presentation: "modal",
            headerShown: true,
            headerTitle: "Chat",
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
          }}
        />
        <Stack.Screen
          name="(auth)"
          options={{
            presentation: "modal",
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ConvexProvider>
      <ThemeProvider>
        <RootLayoutNav />
      </ThemeProvider>
    </ConvexProvider>
  );
}
