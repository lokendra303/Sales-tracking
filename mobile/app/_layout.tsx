import { Component, type ReactNode } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, Pressable, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/lib/auth";
import { FieldProvider } from "@/lib/field";
import { OfflineProvider } from "@/lib/offline";
import { ReminderProvider } from "@/lib/reminders-context";
import { colors } from "@/lib/theme";
import "@/lib/location-task";

if (Platform.OS === "web") {
  const webText = Text as typeof Text & { defaultProps?: { style?: object } };
  webText.defaultProps = webText.defaultProps ?? {};
  webText.defaultProps.style = { fontFamily: "Arial, Helvetica, sans-serif" };
}

class AppGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.bg, gap: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text, textAlign: "center" }}>SalesTrack needs a restart</Text>
          <Text style={{ color: colors.muted, textAlign: "center" }}>The screen hit a problem. Open the app again.</Text>
          <Pressable onPress={() => this.setState({ failed: false })} style={{ backgroundColor: colors.blue, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 }}>
            <Text style={{ color: "#fff", fontWeight: "800" }}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  return (
    <AppGuard>
    <SafeAreaProvider>
    <AuthProvider>
      <StatusBar style="dark" />
      <OfflineProvider>
      <ReminderProvider>
      <FieldProvider>
        <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="profile/edit" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="lead/new" />
        <Stack.Screen name="lead/[id]" />
        <Stack.Screen name="follow-up/new" />
        <Stack.Screen name="user/new" />
        <Stack.Screen name="user/[id]" />
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
    </AppGuard>
  );
}
