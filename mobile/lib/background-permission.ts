import { Alert, Platform } from "react-native";
import { persistGet, persistSet } from "./persist";

type BatteryModule = typeof import("expo-battery");
type IntentModule = typeof import("expo-intent-launcher");

const askedKey = "background-asked";

function battery(): BatteryModule | null {
  try {
    return require("expo-battery") as BatteryModule;
  } catch {
    return null;
  }
}

function intents(): IntentModule | null {
  try {
    return require("expo-intent-launcher") as IntentModule;
  } catch {
    return null;
  }
}

function packageName() {
  try {
    const loaded = require("expo-constants") as {
      default?: { expoConfig?: { android?: { package?: string } } };
      expoConfig?: { android?: { package?: string } };
    };
    return (loaded.default ?? loaded).expoConfig?.android?.package || "com.salestrack.app";
  } catch {
    return "com.salestrack.app";
  }
}

/** true = allowed, false = phone may stop the app, null = cannot tell (iOS, web, old build). */
export async function backgroundAllowed(): Promise<boolean | null> {
  if (Platform.OS !== "android") return null;
  const Battery = battery();
  if (!Battery) return null;
  try {
    return !(await Battery.isBatteryOptimizationEnabledAsync());
  } catch {
    return null;
  }
}

export async function askBackgroundPermission(): Promise<boolean | null> {
  if (Platform.OS !== "android") return null;
  const Intent = intents();
  if (!Intent) return null;
  try {
    await Intent.startActivityAsync(Intent.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, {
      data: `package:${packageName()}`,
    });
  } catch {
    try {
      await Intent.startActivityAsync(Intent.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
    } catch {
      return null;
    }
  }
  return backgroundAllowed();
}

export async function promptBackgroundOnce() {
  try {
    if (Platform.OS !== "android") return;
    if ((await persistGet(askedKey)) === "1") return;
    if ((await backgroundAllowed()) !== false) return;
    await persistSet(askedKey, "1");
    Alert.alert(
      "Run in background?",
      "Allow SalesTrack to keep running in the background so new lead alerts and reminders reach you even when the app is closed.",
      [
        { text: "Not now", style: "cancel" },
        { text: "Allow", onPress: () => void askBackgroundPermission() },
      ],
    );
  } catch {
    // Never block the app over this prompt.
  }
}
