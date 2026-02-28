import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";

// ✅ Use root entry so app/index.tsx controls first screen
export const unstable_settings = {
  anchor: "index",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      {/* ✅ Hide headers globally (prevents "auth/auth" and "(tabs)" back label) */}
      <Stack screenOptions={{ headerShown: false }}>
        {/* Auth */}
        <Stack.Screen name="auth/auth" options={{ headerShown: false }} />

        {/* Tabs */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* Modal (optional header can be on if you want) */}
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal", headerShown: true }}
        />
      </Stack>

      <StatusBar style="auto" />
    </ThemeProvider>
  );
}