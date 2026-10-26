import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  findNodeHandle,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
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
import { mobileDigits } from "@/lib/phone";

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
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!keyboard) return;
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (event) => {
      setKb(event.endCoordinates?.height ?? 280);
    });
    const hide = Keyboard.addListener(hideEvent, () => setKb(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [keyboard]);

  useEffect(() => {
    if (!keyboard || !scroll || kb <= 0) return;
    const timer = setTimeout(() => {
      const focused = (TextInput.State as { currentlyFocusedInput?: () => object | null }).currentlyFocusedInput?.();
      const node = focused ? findNodeHandle(focused as never) : null;
      const responder = scrollRef.current?.getScrollResponder?.() as
        | {
            scrollResponderScrollNativeHandleToKeyboard?: (
              nodeHandle: number,
              additionalOffset: number,
              preventNegativeScrollOffset?: boolean,
            ) => void;
          }
        | undefined;
      if (node && responder?.scrollResponderScrollNativeHandleToKeyboard) {
        responder.scrollResponderScrollNativeHandleToKeyboard(node, 120, true);
        return;
      }
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 60);
    return () => clearTimeout(timer);
  }, [kb, keyboard, scroll]);

  const contentStyle = {
    paddingHorizontal: padded ? pagePad : 0,
    paddingTop: 4,
    paddingBottom: (keyboard ? 32 : 36) + (keyboard ? kb : 0),
    gap: compact ? 12 : 14,
    width: "100%" as const,
    maxWidth: 560,
    alignSelf: "center" as const,
    flexGrow: 1,
  };

  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      style={styles.flex}
      contentContainerStyle={contentStyle}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      nestedScrollEnabled
      scrollEnabled
      showsVerticalScrollIndicator={kb > 0}
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
  digitsOnly,
  onChangeText,
  ...props
}: TextInputProps & { label?: string; right?: ReactNode; multiline?: boolean; digitsOnly?: boolean }) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={[styles.inputWrap, multiline && styles.inputWrapTall]}>
        <TextInput
          {...props}
          multiline={multiline}
          keyboardType={digitsOnly ? "number-pad" : props.keyboardType}
          inputMode={digitsOnly ? "numeric" : props.inputMode}
          autoComplete={digitsOnly ? "tel" : props.autoComplete}
          placeholderTextColor={colors.muted}
          onChangeText={(text) => onChangeText?.(digitsOnly ? mobileDigits(text) : text)}
          style={[styles.input, multiline && styles.inputTall, right ? styles.inputWithIcon : null, props.style]}
        />
        {right ? <View style={styles.inputIcon}>{right}</View> : null}
      </View>
    </View>
  );
}

export function PasswordField({
  label,
  value,
  onChangeText,
  placeholder = "Password",
  startVisible = false,
}: {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  startVisible?: boolean;
}) {
  const [show, setShow] = useState(startVisible);
  return (
    <Field
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      secureTextEntry={!show}
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="password"
      textContentType="password"
      right={
        <Pressable
          style={styles.eye}
          hitSlop={8}
          onPress={() => setShow((on) => !on)}
          accessibilityRole="button"
          accessibilityLabel={show ? "Hide password" : "Show password"}
        >
          <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={22} color={colors.blue} />
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
  const { width } = useWindowDimensions();
  const stack = width < 360;
  const columns = width >= 720 ? "23%" : "47%";
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
        flex && (stack ? styles.btnStack : [styles.btnFlex, { flexBasis: columns }]),
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.45 : pressed ? 0.88 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.btnInner}>
          {icon ? <Ionicons name={icon} size={18} color={palette.fg} /> : null}
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.btnText, { color: palette.fg }]}>
            {title}
          </Text>
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
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
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

type Tone = "blue" | "green" | "amber" | "red" | "slate";

const tones: Record<Tone, { bg: string; fg: string }> = {
  blue: { bg: colors.blueSoft, fg: colors.blue },
  green: { bg: colors.greenSoft, fg: colors.green },
  amber: { bg: colors.amberSoft, fg: colors.amber },
  red: { bg: colors.redSoft, fg: colors.red },
  slate: { bg: "#F1F5F9", fg: colors.muted },
};

export function TileGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

export function KpiTile({
  icon,
  label,
  value,
  hint,
  tone = "blue",
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  onPress?: () => void;
}) {
  const { wide } = useLayout();
  const palette = tones[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [styles.kpi, { flexBasis: wide ? "23%" : "46%" }, pressed && styles.pressed]}
    >
      <View style={styles.kpiTop}>
        <View style={[styles.kpiIcon, { backgroundColor: palette.bg }]}>
          <Ionicons name={icon} size={18} color={palette.fg} />
        </View>
        {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.muted} /> : null}
      </View>
      <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {value}
      </Text>
      <Text style={styles.kpiLabel} numberOfLines={1}>
        {label}
      </Text>
      {hint ? (
        <Text style={[styles.kpiHint, { color: palette.fg }]} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function ActionTile({
  icon,
  label,
  onPress,
  tone = "blue",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: Tone;
}) {
  const palette = tones[tone];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label.replace(/\n/g, " ")}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <View style={[styles.actionIcon, { backgroundColor: palette.bg }]}>
        <Ionicons name={icon} size={22} color={palette.fg} />
      </View>
      <Text style={styles.actionLabel} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
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
    width: "100%",
    maxWidth: "100%",
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
  inputWithIcon: { paddingRight: 52 },
  inputTall: { minHeight: 88, textAlignVertical: "top" },
  inputIcon: {
    position: "absolute",
    right: 4,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    zIndex: 2,
  },
  eye: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  btn: {
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    minHeight: 48,
    overflow: "hidden",
  },
  btnFlex: { flexGrow: 1, flexShrink: 1, flexBasis: "47%", maxWidth: "100%" },
  btnStack: { width: "100%" },
  btnInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, maxWidth: "100%" },
  btnText: { fontWeight: "800", fontSize: 14, textAlign: "center", flexShrink: 1 },
  chip: {
    alignSelf: "flex-start",
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
  stat: { flexGrow: 1, flexBasis: "22%", minWidth: 64, maxWidth: "100%", alignItems: "center", gap: 4 },
  statValue: { fontSize: 20, fontWeight: "800", color: colors.text, width: "100%", textAlign: "center" },
  statLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch", gap: 8, width: "100%" },
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
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, width: "100%" },
  kpi: {
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: 4,
    ...shadow,
  },
  kpiTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  kpiIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  kpiValue: { fontSize: 24, fontWeight: "800", color: colors.text },
  kpiLabel: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  kpiHint: { fontSize: 12, fontWeight: "700" },
  action: {
    width: 96,
    flexGrow: 0,
    flexShrink: 0,
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 8,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow,
  },
  actionIcon: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  actionLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 15,
    width: "100%",
  },
  section: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  sectionAction: { color: colors.blue, fontWeight: "800", fontSize: 13 },
});
