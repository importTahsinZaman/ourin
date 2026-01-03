import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="login" options={{ title: "Sign In" }} />
      <Stack.Screen name="verify" options={{ title: "Verify Email" }} />
    </Stack>
  );
}
