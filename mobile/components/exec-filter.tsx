import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Chip } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { colors, shadow } from "@/lib/theme";

export type ExecPerson = { id: number; name: string };
export type ExecValue = "all" | "unassigned" | number;

export function useExecutives() {
  const { accessToken, user } = useAuth();
  const manager = isManager(user?.roles);
  const [people, setPeople] = useState<ExecPerson[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!accessToken || !manager) return;
      api<{ id: number; name: string; roles: string[] }[]>("/users", { token: accessToken })
        .then((rows) =>
          setPeople(
            rows
              .filter((row) => row.roles.includes("SALES_EXECUTIVE"))
              .map((row) => ({ id: row.id, name: row.name })),
          ),
        )
        .catch(() => undefined);
    }, [accessToken, manager]),
  );

  return { manager, people };
}

export function ExecFilter({
  people,
  value,
  onChange,
  includeUnassigned = false,
}: {
  people: ExecPerson[];
  value: ExecValue;
  onChange: (next: ExecValue) => void;
  includeUnassigned?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!people.length && !includeUnassigned) return null;
  const options = [
    { id: "all", label: "All executives" },
    ...(includeUnassigned ? [{ id: "unassigned", label: "Unassigned" }] : []),
    ...people.map((person) => ({ id: String(person.id), label: person.name })),
  ];
  const current = value === "all" || value === "unassigned" ? value : String(value);
  const label = options.find((option) => option.id === current)?.label ?? "All executives";
  return (
    <View style={[styles.menu, open && styles.menuOpen]}>
      <Pressable style={styles.menuBtn} onPress={() => setOpen((on) => !on)} accessibilityRole="button">
        <Text style={styles.menuText} numberOfLines={1}>
          {label}
        </Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} />
      </Pressable>
      {open ? (
        <View style={styles.menuList}>
          {options.map((option) => {
            const on = option.id === current;
            return (
              <Pressable
                key={option.id}
                style={[styles.menuItem, on && styles.menuItemOn]}
                onPress={() => {
                  onChange(option.id === "all" || option.id === "unassigned" ? option.id : Number(option.id));
                  setOpen(false);
                }}
              >
                <Text style={[styles.menuItemText, on && styles.menuItemTextOn]} numberOfLines={1}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export function ExecPicker({
  people,
  value,
  onChange,
  allowUnassign = false,
}: {
  people: ExecPerson[];
  value: number | null;
  onChange: (next: number | null) => void;
  allowUnassign?: boolean;
}) {
  if (!people.length && !allowUnassign) return null;
  return (
    <View style={styles.wrap}>
      {allowUnassign ? <Chip label="Unassign" on={value == null} onPress={() => onChange(null)} /> : null}
      {people.map((person) => (
        <Chip key={person.id} label={person.name} on={value === person.id} onPress={() => onChange(person.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  menu: { zIndex: 8 },
  menuOpen: { zIndex: 12 },
  menuBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  menuText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "500" },
  menuList: {
    position: "absolute",
    top: 40,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    overflow: "hidden",
    zIndex: 12,
    elevation: 8,
    ...shadow,
  },
  menuItem: { paddingHorizontal: 12, paddingVertical: 9, backgroundColor: "#fff" },
  menuItemOn: { backgroundColor: "#EEF4FF" },
  menuItemText: { color: colors.text, fontSize: 14, fontWeight: "400" },
  menuItemTextOn: { fontWeight: "600", color: colors.blue },
  wrap: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
});
