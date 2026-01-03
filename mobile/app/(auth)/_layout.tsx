import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: "#1a1a1a",
        },
        headerTintColor: "#f5f5f4",
        headerTitleStyle: {
          fontWeight: "600",
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: "#1a1a1a",
        },
      }}
    >
      <Stack.Screen name="login" options={{ title: "Sign In" }} />
      <Stack.Screen name="verify" options={{ title: "Verify Email" }} />
    </Stack>
  );
}
