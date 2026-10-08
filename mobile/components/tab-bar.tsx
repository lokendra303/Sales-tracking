import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/theme";

type TabBarProps = {
  state: {
    index: number;
    routes: { key: string; name: string; params?: object }[];
  };
  descriptors: Record<string, { options: { title?: string; href?: string | null; tabBarShowLabel?: boolean } }>;
  navigation: {
    emit: (event: { type: string; target: string; canPreventDefault: boolean }) => { defaultPrevented: boolean };
    navigate: (name: string, params?: object) => void;
  };
};

const icons: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  index: ["home-outline", "home"],
  leads: ["briefcase-outline", "briefcase"],
  visits: ["location-outline", "location"],
  reports: ["bar-chart-outline", "bar-chart"],
  team: ["people-outline", "people"],
  settings: ["settings-outline", "settings"],
  more: ["person-outline", "person"],
};

export function AppTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const items = state.routes.filter((route) => {
    const options = descriptors[route.key].options;
    if (options.href === null || options.tabBarShowLabel === false) return false;
    return true;
  });

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {items.map((route) => {
        const index = state.routes.indexOf(route);
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const pair = icons[route.name] ?? ["ellipse-outline", "ellipse"];
        const color = focused ? colors.blue : colors.muted;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={label}
            onPress={() => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            }}
            style={styles.item}
          >
            <Ionicons name={focused ? pair[1] : pair[0]} size={22} color={color} />
            <Text style={[styles.label, { color }, focused && styles.labelOn]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 10,
    minHeight: 64,
    zIndex: 20,
    elevation: 16,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
  },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, minHeight: 44 },
  label: { fontSize: 11, fontWeight: "600" },
  labelOn: { fontWeight: "800" },
});
