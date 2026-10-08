import { Platform, StyleSheet } from "react-native";

export const colors = {
  bg: "#F3F6FB",
  card: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  line: "#E8EEF6",
  blue: "#2563EB",
  blueSoft: "#EFF4FF",
  green: "#16A34A",
  greenSoft: "#ECFDF5",
  red: "#DC2626",
  redSoft: "#FEF2F2",
  amber: "#D97706",
  amberSoft: "#FFFBEB",
  chip: "#EEF2FF",
  ink: "#1E3A8A",
};

export const space = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
};

export const radius = {
  sm: 12,
  md: 16,
  lg: 22,
  pill: 999,
};

export const typo = {
  title: { fontSize: 24, fontWeight: "800" as const, color: colors.text, letterSpacing: 0 },
  heading: { fontSize: 17, fontWeight: "800" as const, color: colors.text, letterSpacing: 0 },
  body: { fontSize: 15, fontWeight: "500" as const, color: colors.text, lineHeight: 22, letterSpacing: 0.2 },
  muted: { fontSize: 13, fontWeight: "500" as const, color: colors.muted, lineHeight: 20, letterSpacing: 0.15 },
  label: { fontSize: 13, fontWeight: "700" as const, color: colors.muted, letterSpacing: 0.15 },
};

export const shadow = Platform.select({
  ios: {
    shadowColor: "#0F172A",
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  android: { elevation: 3 },
  default: { boxShadow: "0 10px 28px rgba(15, 23, 42, 0.07)" },
}) as object;

export const hairline = StyleSheet.hairlineWidth;
