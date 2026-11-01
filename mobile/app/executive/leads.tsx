import { useCallback, useState } from "react";
import { useFocusEffect, router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card, EmptyState, Screen, ScreenHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api, type Lead } from "@/lib/api";
import { pickedBeat, pickedHq, personCatalog, type PersonCatalog } from "@/lib/person-scope";
import { colors, shadow, typo } from "@/lib/theme";

function Menu({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.id === value)?.label ?? "None";
  return (
    <View style={[styles.menu, open && styles.menuOpen]}>
      <Pressable style={styles.menuBtn} onPress={() => setOpen((on) => !on)} accessibilityRole="button">
        <Text style={styles.menuText} numberOfLines={1}>
          {current}
        </Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} />
      </Pressable>
      {open ? (
        <View style={styles.menuList}>
          {options.map((option) => {
            const on = option.id === value;
            return (
              <Pressable
                key={option.id}
                style={[styles.menuItem, on && styles.menuItemOn]}
                onPress={() => {
                  onChange(option.id);
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

export default function ExecutiveLeadsScreen() {
  const { userId, name } = useLocalSearchParams<{ userId?: string; name?: string }>();
  const id = Number(userId);
  const person = name?.trim() || "Salesperson";
  const { accessToken } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [hqPick, setHqPick] = useState("");
  const [beatPick, setBeatPick] = useState<number | null>(null);

  const load = useCallback(() => {
    if (!accessToken || !id) return;
    setLoading(true);
    api<{ leads: Lead[] }>(`/leads?filter=all&assigneeId=${id}&includeCreated=1`, { token: accessToken })
      .then((data) => setLeads(data.leads ?? []))
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  }, [accessToken, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const catalog: PersonCatalog = personCatalog(
    leads.map((lead) => ({ leadId: lead.id, beats: lead.beats ?? [] })),
  );
  const hq = pickedHq(catalog, hqPick);
  const beatId = hq ? pickedBeat(catalog, hq, beatPick) : null;
  const added = catalog.hqs.find((item) => item.name === "No HQ");
  const placed = catalog.hqs.filter((item) => item.name !== "No HQ");
  const groups = (hq ? placed.filter((item) => item.name === hq) : placed).map((item) => ({
    ...item,
    beats: hq && beatId != null ? item.beats.filter((beat) => beat.id === beatId) : item.beats,
  }));

  function leadById(leadId: number) {
    return leads.find((lead) => lead.id === leadId);
  }

  return (
    <Screen
      header={
        <ScreenHeader
          title={`${person}'s leads`}
          subtitle={`${leads.length} lead${leads.length === 1 ? "" : "s"} · beats and leads they added`}
          back
        />
      }
    >
      {loading ? (
        <ActivityIndicator color={colors.blue} />
      ) : !leads.length ? (
        <EmptyState icon="briefcase-outline" text={`${person} has no assigned or added leads yet.`} />
      ) : (
        <>
          <View style={styles.menus}>
            <Menu
              value={hq}
              options={[
                { id: "", label: `${person} · ${leads.length}` },
                ...placed.map((item) => ({
                  id: item.name,
                  label: `${item.name} · ${item.beats.reduce((sum, beat) => sum + beat.leadIds.length, 0)}`,
                })),
                ...(added ? [{ id: "No HQ", label: `Added by ${person} · ${added.beats[0]?.leadIds.length ?? 0}` }] : []),
              ]}
              onChange={(next) => {
                setHqPick(next);
                setBeatPick(null);
              }}
            />
            {hq && hq !== "No HQ" ? (
              <Menu
                value={beatId == null ? "" : String(beatId)}
                options={(placed.find((item) => item.name === hq)?.beats ?? []).map((item) => ({
                  id: String(item.id),
                  label: `${item.name} · ${item.leadIds.length}`,
                }))}
                onChange={(next) => setBeatPick(Number(next))}
              />
            ) : null}
          </View>
          {groups.map((group) =>
            group.beats.map((beat) => (
              <View key={`${group.name}-${beat.id}`} style={styles.block}>
                <Text style={styles.scope}>
                  {group.name} · {beat.name} · {beat.leadIds.length}
                </Text>
                {beat.leadIds.map((leadId) => {
                  const lead = leadById(leadId);
                  if (!lead) return null;
                  return (
                    <Pressable key={lead.id} onPress={() => router.push(`/lead/${lead.id}`)}>
                      <Card>
                        <Text style={styles.name}>{lead.name}</Text>
                        <Text style={typo.muted}>{[group.name, beat.name].filter(Boolean).join(" · ")}</Text>
                        <Text style={typo.muted}>{[lead.city, lead.phone].filter(Boolean).join(" · ") || "No phone"}</Text>
                      </Card>
                    </Pressable>
                  );
                })}
              </View>
            )),
          )}
          {added ? (
            <View style={styles.block}>
              <Text style={styles.scope}>
                Added by {person} · {added.beats[0]?.leadIds.length ?? 0}
              </Text>
              <Text style={typo.muted}>Created or visited by them, and not on a beat yet.</Text>
              {added.beats[0]?.leadIds.map((leadId) => {
                const lead = leadById(leadId);
                if (!lead) return null;
                return (
                  <Pressable key={lead.id} onPress={() => router.push(`/lead/${lead.id}`)}>
                    <Card>
                      <Text style={styles.name}>{lead.name}</Text>
                      <Text style={typo.muted}>Added by {lead.createdByName || person}</Text>
                      <Text style={typo.muted}>{[lead.city, lead.phone].filter(Boolean).join(" · ") || "No phone"}</Text>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  menus: { flexDirection: "row", gap: 8, zIndex: 4 },
  menu: { flex: 1, zIndex: 2 },
  menuOpen: { zIndex: 8 },
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
    paddingVertical: 10,
  },
  menuText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "600" },
  menuList: {
    position: "absolute",
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    zIndex: 8,
    elevation: 8,
    ...shadow,
  },
  menuItem: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fff" },
  menuItemOn: { backgroundColor: colors.blueSoft },
  menuItemText: { color: colors.text, fontSize: 14 },
  menuItemTextOn: { color: colors.blue, fontWeight: "600" },
  block: { gap: 8 },
  scope: { color: colors.blue, fontWeight: "700" },
  name: { fontSize: 16, fontWeight: "700", color: colors.ink },
});
