export type ScopeBeat = { id: number; name: string; hq: string | null };

export type ScopePlace = {
  leadId: number;
  beats: ScopeBeat[];
};

export type ScopeBeatGroup = { id: number; name: string; leadIds: number[] };

export type PersonCatalog = {
  hqs: { name: string; beats: ScopeBeatGroup[] }[];
  noBeatLeadIds: number[];
};

export function personCatalog(places: ScopePlace[]): PersonCatalog {
  const hqMap = new Map<string, ScopeBeatGroup[]>();
  const noBeatLeadIds: number[] = [];
  for (const place of places) {
    if (!place.beats.length) {
      noBeatLeadIds.push(place.leadId);
      continue;
    }
    for (const beat of place.beats) {
      const hq = beat.hq?.trim() || "No HQ";
      const list = hqMap.get(hq) ?? [];
      let group = list.find((item) => item.id === beat.id);
      if (!group) {
        group = { id: beat.id, name: beat.name, leadIds: [] };
        list.push(group);
      }
      if (!group.leadIds.includes(place.leadId)) group.leadIds.push(place.leadId);
      hqMap.set(hq, list);
    }
  }
  const hqs = [...hqMap.entries()]
    .map(([name, beats]) => ({
      name,
      beats: beats.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (noBeatLeadIds.length) {
    hqs.push({ name: "No HQ", beats: [{ id: -1, name: "No beat", leadIds: noBeatLeadIds }] });
  }
  return { hqs, noBeatLeadIds };
}

/** Empty pick means every HQ and beat for this one person, including leads they added with no beat. */
export function pickedHq(catalog: PersonCatalog, pick: string) {
  if (pick && catalog.hqs.some((hq) => hq.name === pick)) return pick;
  return "";
}

export function pickedBeat(catalog: PersonCatalog, hqName: string, pick: number | null) {
  const beats = catalog.hqs.find((hq) => hq.name === hqName)?.beats ?? [];
  if (pick != null && beats.some((beat) => beat.id === pick)) return pick;
  return beats[0]?.id ?? null;
}
