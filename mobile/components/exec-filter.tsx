import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Chip } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isManager } from "@/lib/roles";

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
  if (!people.length && !includeUnassigned) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Chip label="All executives" on={value === "all"} onPress={() => onChange("all")} />
      {includeUnassigned ? (
        <Chip label="Unassigned" on={value === "unassigned"} onPress={() => onChange("unassigned")} />
      ) : null}
      {people.map((person) => (
        <Chip key={person.id} label={person.name} on={value === person.id} onPress={() => onChange(person.id)} />
      ))}
    </ScrollView>
  );
}

export function ExecPicker({
  people,
  value,
  onChange,
}: {
  people: ExecPerson[];
  value: number | null;
  onChange: (next: number) => void;
}) {
  if (!people.length) return null;
  return (
    <View style={styles.wrap}>
      {people.map((person) => (
        <Chip key={person.id} label={person.name} on={value === person.id} onPress={() => onChange(person.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingRight: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
