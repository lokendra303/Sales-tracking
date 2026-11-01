import { useCallback, useState } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { ActivityIndicator } from "react-native";
import { VisitHistory } from "@/components/visit-history";
import { Screen, ScreenHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api, type Lead } from "@/lib/api";
import { type ScopePlace } from "@/lib/person-scope";
import { colors } from "@/lib/theme";

export default function ExecutiveVisitsScreen() {
  const { userId, name } = useLocalSearchParams<{ userId?: string; name?: string }>();
  const id = Number(userId);
  const person = name?.trim() || "Salesperson";
  const { accessToken } = useAuth();
  const [places, setPlaces] = useState<ScopePlace[] | null>(null);

  const load = useCallback(() => {
    if (!accessToken || !id) return;
    api<{ leads: Lead[] }>(`/leads?filter=all&assigneeId=${id}&includeCreated=1`, { token: accessToken })
      .then((data) =>
        setPlaces((data.leads ?? []).map((lead) => ({ leadId: lead.id, beats: lead.beats ?? [] }))),
      )
      .catch(() => setPlaces([]));
  }, [accessToken, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <Screen
      header={
        <ScreenHeader
          title={`${person}'s visits`}
          subtitle="Visits they finished, including leads they added"
          back
        />
      }
    >
      {places == null ? (
        <ActivityIndicator color={colors.blue} />
      ) : (
        <VisitHistory userId={id} personName={person} places={places} initialPeriod="7" initialStatus="all" />
      )}
    </Screen>
  );
}
