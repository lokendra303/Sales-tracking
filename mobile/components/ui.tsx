import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewProps,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { type Href } from "expo-router";
import { useLayout } from "@/lib/layout";
import { goBack } from "@/lib/nav";
import { colors, radius, shadow, typo } from "@/lib/theme";

type ScreenProps = {
  children: ReactNode;
  header?: ReactNode;
  scroll?: boolean;
  keyboard?: boolean;
  padded?: boolean;
};

export function Screen({ children, header, scroll = true, keyboard = false, padded = true }: ScreenProps) {
  const { pagePad, compact } = useLayout();
  const [kb, setKb] = useState(0);

  useEffect(() => {
    if (!keyboard) return;
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (event) => {
      setKb(event.endCoordinates?.height ?? 260);
    });
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKb(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [keyboard]);

  const contentStyle = {
    paddingHorizontal: padded ? pagePad : 0,
    paddingTop: 4,
    paddingBottom: (keyboard ? 48 : 36) + (keyboard && Platform.OS !== "ios" ? Math.max(kb, 0) : 0),
    gap: compact ? 12 : 14,
    width: "100%" as const,
    maxWidth: 560,
    alignSelf: "center" as const,
    flexGrow: 1,
  };

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={contentStyle}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      automaticallyAdjustKeyboardInsets={keyboard}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, contentStyle]}>{children}</View>
  );

  return (
    <View style={styles.safe}>
      <SafeAreaView edges={["top"]} style={header ? styles.navSafe : styles.topSafe}>
        {header}
      </SafeAreaView>
      {keyboard ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "android" ? undefined : "padding"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </View>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  back,
  fallback = "/(tabs)",
  right,
  align = "left",
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  fallback?: Href;
  right?: ReactNode;
  align?: "left" | "center";
}) {
  const { pagePad } = useLayout();
  return (
    <View style={[styles.header, { paddingHorizontal: pagePad }]}>
      {back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={16}
          onPress={() => goBack(fallback)}
          style={styles.iconBtn}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
      ) : null}
      <View
        pointerEvents="box-none"
        style={[styles.headerMid, align === "center" && styles.headerMidCenter, !back && { paddingLeft: 0 }]}
      >
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.headerSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.headerRight, back && align === "center" && !right ? { width: 40 } : null]}>{right}</View>
    </View>
  );
}

export function PageTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.pageTitleRow}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={typo.title}>{title}</Text>
        {subtitle ? <Text style={[typo.muted, { marginTop: 4 }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Field({
  label,
  right,
  multiline,
  ...props
}: TextInputProps & { label?: string; right?: ReactNode; multiline?: boolean }) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={[styles.inputWrap, multiline && styles.inputWrapTall]}>
        <TextInput
          {...props}
          multiline={multiline}
          placeholderTextColor={colors.muted}
          style={[styles.input, multiline && styles.inputTall, props.style]}
        />
        {right}
      </View>
    </View>
  );
}

export function PasswordField({
  label,
  value,
  onChangeText,
  placeholder = "Password",
}: {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <Field
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      secureTextEntry={!show}
      autoCapitalize="none"
      right={
        <Pressable
          style={styles.eye}
          onPress={() => setShow((on) => !on)}
          accessibilityLabel={show ? "Hide password" : "Show password"}
        >
          <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={20} color={colors.blue} />
        </Pressable>
      }
    />
  );
}

type BtnProps = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: "blue" | "green" | "red" | "outline" | "ghost";
  icon?: keyof typeof Ionicons.glyphMap;
  flex?: boolean;
};

export function Button({ title, onPress, disabled, loading, tone = "blue", icon, flex }: BtnProps) {
  const palette = {
    blue: { bg: colors.blue, fg: "#fff", border: colors.blue },
    green: { bg: colors.green, fg: "#fff", border: colors.green },
    red: { bg: colors.red, fg: "#fff", border: colors.red },
    outline: { bg: "#fff", fg: colors.blue, border: colors.blue },
    ghost: { bg: "transparent", fg: colors.red, border: "transparent" },
  }[tone];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        flex && styles.flex,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.45 : pressed ? 0.88 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.btnInner}>
          {icon ? <Ionicons name={icon} size={18} color={palette.fg} /> : null}
          <Text style={[styles.btnText, { color: palette.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  on,
  onPress,
}: {
  label: string;
  on?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function Badge({
  label,
  tone = "blue",
}: {
  label: string;
  tone?: "blue" | "green" | "amber" | "red" | "slate";
}) {
  const map = {
    blue: { bg: colors.blueSoft, fg: colors.ink },
    green: { bg: colors.greenSoft, fg: "#166534" },
    amber: { bg: colors.amberSoft, fg: "#92400E" },
    red: { bg: colors.redSoft, fg: "#991B1B" },
    slate: { bg: "#F1F5F9", fg: colors.muted },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: map.bg }]}>
      <Text style={[styles.badgeText, { color: map.fg }]}>{label}</Text>
    </View>
  );
}

export function Avatar({ name, size = 44, tone = "blue" }: { name: string; size?: number; tone?: "blue" | "green" }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tone === "green" ? colors.green : colors.blue,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: size * 0.38 }}>{(name || "?").slice(0, 1)}</Text>
    </View>
  );
}

export function EmptyState({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={22} color={colors.blue} />
      </View>
      <Text style={[typo.muted, { textAlign: "center" }]}>{text}</Text>
    </View>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function ActionRow({ children }: { children: ReactNode }) {
  return <View style={styles.actions}>{children}</View>;
}

export function IconRound({
  name,
  color = colors.blue,
  bg = colors.blueSoft,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color?: string;
  bg?: string;
}) {
  return (
    <View style={[styles.iconRound, { backgroundColor: bg }]}>
      <Ionicons name={name} size={20} color={color} />
    </View>
  );
}

export function SearchBox(props: TextInputProps & { onSubmit?: () => void }) {
  return (
    <View style={styles.search}>
      <Ionicons name="search-outline" size={18} color={colors.muted} />
      <TextInput
        {...props}
        placeholderTextColor={colors.muted}
        style={styles.searchInput}
        returnKeyType="search"
        onSubmitEditing={props.onSubmit}
      />
    </View>
  );
}

export function ListScroll({ children, ...props }: ScrollViewProps & { children: ReactNode }) {
  const { pagePad } = useLayout();
  return (
    <ScrollView
      {...props}
      style={styles.flex}
      contentContainerStyle={{ paddingHorizontal: pagePad, paddingBottom: 36, gap: 12 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  navSafe: { backgroundColor: "#fff", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  topSafe: { backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingVertical: 8,
    gap: 10,
    backgroundColor: "#fff",
  },
  headerMid: { flex: 1, alignItems: "flex-start" },
  headerMidCenter: { alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  headerSub: { ...typo.muted, marginTop: 2 },
  headerRight: { minWidth: 40, alignItems: "flex-end", justifyContent: "center" },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  pageTitleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 10,
    ...shadow,
  },
  field: { gap: 8 },
  fieldLabel: { ...typo.label, color: colors.text },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    minHeight: 52,
  },
  inputWrapTall: { alignItems: "flex-start", minHeight: 96 },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: colors.text },
  inputTall: { minHeight: 88, textAlignVertical: "top" },
  eye: { paddingHorizontal: 14, paddingVertical: 12 },
  btn: {
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    minHeight: 50,
  },
  btnInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  btnText: { fontWeight: "800", fontSize: 15 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  chipText: { color: colors.text, fontWeight: "700", fontSize: 13 },
  chipTextOn: { color: "#fff" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontWeight: "800", fontSize: 11 },
  empty: { alignItems: "center", gap: 10, paddingVertical: 28 },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stat: { flex: 1, alignItems: "center", gap: 4, minWidth: 72 },
  statValue: { fontSize: 20, fontWeight: "800", color: colors.text },
  statLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  iconRound: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    minHeight: 48,
    ...shadow,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 12 },
});
