import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/lib/auth";
import { FieldProvider } from "@/lib/field";
import { OfflineProvider } from "@/lib/offline";
import { ReminderProvider } from "@/lib/reminders-context";
import "@/lib/location-task";

if (Platform.OS === "web") {
  const webText = Text as typeof Text & { defaultProps?: { style?: object } };
  webText.defaultProps = webText.defaultProps ?? {};
  webText.defaultProps.style = { fontFamily: "Arial, Helvetica, sans-serif" };
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
    <AuthProvider>
      <StatusBar style="dark" />
      <OfflineProvider>
      <ReminderProvider>
      <FieldProvider>
        <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="lead/new" />
        <Stack.Screen name="lead/[id]" />
        <Stack.Screen name="follow-up/new" />
        <Stack.Screen name="user/new" />
        <Stack.Screen name="visit/check-in" />
        <Stack.Screen name="visit/[id]" />
        <Stack.Screen name="sale/new" />
        <Stack.Screen name="notifications" />
        </Stack>
      </FieldProvider>
      </ReminderProvider>
      </OfflineProvider>
    </AuthProvider>
    </SafeAreaProvider>
  );
}
