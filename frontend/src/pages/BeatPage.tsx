import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

type Person = { userId: number; name: string; stopCount?: number };
type Member = {
  id: number;
  sequence: number;
  leadId: number | null;
  customerId: number | null;
  name: string;
  phone: string | null;
  city: string | null;
};
type Beat = {
  id: number;
  name: string;
  territory?: string | null;
  assigneeId: number;
  assigneeName: string | null;
  active: boolean;
  notes: string | null;
  size: number;
  members: Member[];
};
type Place = {
  id: number;
  kind: "lead" | "customer";
  name: string;
  phone: string;
  city: string | null;
  status?: string;
  approvalStatus?: string;
  assigneeId?: number | null;
};
type DayMap = Record<number, { beatId: number; beatName: string } | null>;

const CYCLE_PRESETS = [7, 15, 20, 30];

function isoToday() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function dateForDayIndex(startDate: string, dayIndex: number) {
  const [y, m, d] = startDate.split("-").map(Number);
  const next = new Date(y, m - 1, d);
  next.setDate(next.getDate() + dayIndex);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

export function BeatPage() {
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<"beats" | "schedule">("beats");
  const [people, setPeople] = useState<Person[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [selectedBeatId, setSelectedBeatId] = useState<number | null>(null);
  const [days, setDays] = useState<DayMap>({});
  const [cycleLength, setCycleLength] = useState(15);
  const [startDate, setStartDate] = useState(isoToday());
  const [todayIndex, setTodayIndex] = useState<number | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [q, setQ] = useState("");
  const [newName, setNewName] = useState("");
  const [newTerritory, setNewTerritory] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = beats.find((b) => b.id === selectedBeatId) ?? null;
  const personBeats = useMemo(
    () => beats.filter((b) => b.assigneeId === userId && b.active),
    [beats, userId],
  );

  const taken = useMemo(() => {
    const keys = new Set<string>();
    for (const stop of selected?.members ?? []) {
      if (stop.leadId) keys.add(`lead:${stop.leadId}`);
      if (stop.customerId) keys.add(`customer:${stop.customerId}`);
    }
    return keys;
  }, [selected]);

  const available = places.filter((place) => {
    if (place.status === "LOST") return false;
    if (place.kind === "lead" && place.approvalStatus && place.approvalStatus !== "APPROVED") return false;
    if (taken.has(`${place.kind}:${place.id}`)) return false;
    if (place.kind === "lead" && userId && place.assigneeId && place.assigneeId !== userId) return false;
    if (!q.trim()) return true;
    const hay = `${place.name} ${place.phone} ${place.city ?? ""}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  async function loadPeople() {
    if (!accessToken) return;
    const data = await api<{ date: string; people: Person[] }>("/beat", { token: accessToken });
    setPeople(data.people ?? []);
    if (!userId && data.people[0]) setUserId(data.people[0].userId);
  }

  async function loadBeats() {
    if (!accessToken) return;
    const data = await api<Beat[]>("/beats", { token: accessToken });
    setBeats(data);
    if (selectedBeatId && !data.some((b) => b.id === selectedBeatId)) setSelectedBeatId(null);
    if (!selectedBeatId && data[0]) setSelectedBeatId(data[0].id);
  }

  async function loadSchedule(uid: number) {
    if (!accessToken) return;
    const data = await api<{
      userId: number;
      cycleLength: number;
      startDate: string;
      todayIndex: number | null;
      days?: DayMap;
      week?: DayMap;
    }>(`/beat/schedule?userId=${uid}`, { token: accessToken });
    const length = data.cycleLength || 15;
    setCycleLength(length);
    setStartDate(data.startDate || isoToday());
    setTodayIndex(data.todayIndex ?? null);
    const next: DayMap = {};
    for (let i = 0; i < length; i++) next[i] = null;
    const source = data.days ?? data.week ?? {};
    for (const [k, v] of Object.entries(source)) {
      const idx = Number(k);
      if (idx >= 0 && idx < length) next[idx] = v;
    }
    setDays(next);
  }

  async function loadPlaces() {
    if (!accessToken) return;
    const data = await api<{ leads: Place[]; customers: Place[] }>("/leads", { token: accessToken });
    setPlaces([
      ...(data.leads ?? []).map((lead) => ({ ...lead, kind: "lead" as const })),
      ...(data.customers ?? []).map((customer) => ({ ...customer, kind: "customer" as const })),
    ]);
  }

  useEffect(() => {
    if (!accessToken) return;
    Promise.all([loadPeople(), loadBeats(), loadPlaces()]).catch((err) =>
      setError(err instanceof Error ? err.message : "Could not load."),
    );
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !userId) return;
    loadSchedule(userId).catch(() => undefined);
  }, [accessToken, userId]);

  async function createBeat() {
    if (!accessToken || !userId || !newName.trim()) return;
    setBusy(true);
    setError("");
    try {
      const data = await api<Beat>("/beats", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          name: newName.trim(),
          assigneeId: userId,
          territory: newTerritory.trim() || undefined,
        }),
      });
      setNewName("");
      setNewTerritory("");
      setNotice(`Created “${data.name}” (${data.size} stops).`);
      await loadBeats();
      setSelectedBeatId(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create beat.");
    } finally {
      setBusy(false);
    }
  }

  async function addPlace(place: Place) {
    if (!accessToken || !selected) return;
    setBusy(true);
    setError("");
    try {
      await api(`/beats/${selected.id}/members`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify(place.kind === "lead" ? { leadId: place.id } : { customerId: place.id }),
      });
      await loadBeats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add stop.");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(memberId: number) {
    if (!accessToken) return;
    setBusy(true);
    try {
      await api(`/beats/members/${memberId}`, { method: "DELETE", token: accessToken });
      await loadBeats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove.");
    } finally {
      setBusy(false);
    }
  }

  async function moveMember(index: number, dir: -1 | 1) {
    if (!accessToken || !selected) return;
    const next = [...selected.members];
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setBusy(true);
    try {
      await api(`/beats/${selected.id}/reorder`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ memberIds: next.map((m) => m.id) }),
      });
      await loadBeats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reorder.");
    } finally {
      setBusy(false);
    }
  }

  async function archiveBeat() {
    if (!accessToken || !selected) return;
    if (!window.confirm(`Archive “${selected.name}”? It will leave the schedule options.`)) return;
    setBusy(true);
    try {
      await api(`/beats/${selected.id}`, {
        method: "PATCH",
        token: accessToken,
        body: JSON.stringify({ active: false }),
      });
      setNotice("Beat archived.");
      await loadBeats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not archive.");
    } finally {
      setBusy(false);
    }
  }

  function resizeCycle(length: number) {
    const n = Math.min(90, Math.max(1, Math.floor(length) || 1));
    setCycleLength(n);
    setDays((prev) => {
      const next: DayMap = {};
      for (let i = 0; i < n; i++) next[i] = prev[i] ?? null;
      return next;
    });
  }

  async function saveSchedule() {
    if (!accessToken || !userId) return;
    setBusy(true);
    setError("");
    try {
      const payload: Record<string, number | null> = {};
      for (let d = 0; d < cycleLength; d++) payload[String(d)] = days[d]?.beatId ?? null;
      const data = await api<{
        cycleLength: number;
        startDate: string;
        todayIndex: number | null;
        days?: DayMap;
        week?: DayMap;
      }>("/beat/schedule", {
        method: "PUT",
        token: accessToken,
        body: JSON.stringify({
          userId,
          cycleLength,
          startDate,
          days: payload,
        }),
      });
      setCycleLength(data.cycleLength);
      setStartDate(data.startDate);
      setTodayIndex(data.todayIndex ?? null);
      const next: DayMap = {};
      for (let i = 0; i < data.cycleLength; i++) next[i] = null;
      for (const [k, v] of Object.entries(data.days ?? data.week ?? {})) {
        const idx = Number(k);
        if (idx >= 0 && idx < data.cycleLength) next[idx] = v;
      }
      setDays(next);
      setNotice(`${data.cycleLength}-day schedule saved. The phone picks today’s beat from this cycle.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save schedule.");
    } finally {
      setBusy(false);
    }
  }

  function setDayBeat(dayIndex: number, beatId: number | null) {
    const found = personBeats.find((b) => b.id === beatId) ?? null;
    setDays((prev) => ({
      ...prev,
      [dayIndex]: found ? { beatId: found.id, beatName: found.name } : null,
    }));
  }

  return (
    <div className="page wide">
      <p className="kicker">Field plan</p>
      <h1>Beats</h1>
      <p className="muted">
        Create permanent beats with any number of shops, assign each to a salesperson, then set a rotating cycle (7,
        15, 20, 30 days — or any length up to 90). The phone loads today’s beat from the cycle. Completion = visit
        coverage (visited / total).
      </p>

      <div className="toolbar">
        <button className={`btn ${tab === "beats" ? "blue" : ""}`} type="button" onClick={() => setTab("beats")}>
          Permanent beats
        </button>
        <button className={`btn ${tab === "schedule" ? "blue" : ""}`} type="button" onClick={() => setTab("schedule")}>
          Dynamic schedule
        </button>
      </div>
      {notice ? <p className="on">{notice}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="split">
        <section>
          <h2>Team</h2>
          <div className="list">
            {people.map((person) => (
              <button
                key={person.userId}
                type="button"
                className={`card person pick ${userId === person.userId ? "picked" : ""}`}
                onClick={() => setUserId(person.userId)}
              >
                <div>
                  <strong>{person.name}</strong>
                  <div className="muted">
                    {beats.filter((b) => b.assigneeId === person.userId && b.active).length} active beats
                  </div>
                </div>
              </button>
            ))}
            {!people.length ? <p className="muted">No sales executives yet.</p> : null}
          </div>
        </section>

        {tab === "beats" ? (
          <section>
            <h2>Create beat for {people.find((p) => p.userId === userId)?.name ?? "…"}</h2>
            <div className="toolbar">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Beat name e.g. Beat 1"
                style={{ flex: 1, minWidth: 140 }}
              />
              <input
                value={newTerritory}
                onChange={(e) => setNewTerritory(e.target.value)}
                placeholder="Area e.g. Noida Sector 18"
                style={{ flex: 1, minWidth: 160 }}
              />
              <button className="btn green" type="button" disabled={busy || !userId || !newName.trim()} onClick={createBeat}>
                Create
              </button>
            </div>

            <h2>Beats</h2>
            <div className="list">
              {beats
                .filter((b) => !userId || b.assigneeId === userId)
                .map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={`card person pick ${selectedBeatId === b.id ? "picked" : ""}`}
                    onClick={() => setSelectedBeatId(b.id)}
                  >
                    <div>
                      <strong>
                        {b.name} {!b.active ? "(archived)" : ""}
                      </strong>
                      <div className="muted">
                        {b.size} stops · {b.territory || "No area"} · {b.assigneeName}
                      </div>
                    </div>
                  </button>
                ))}
              {!beats.filter((b) => !userId || b.assigneeId === userId).length ? (
                <p className="muted">No beats yet. Create one above.</p>
              ) : null}
            </div>

            {selected ? (
              <>
                <div className="toolbar" style={{ marginTop: 16 }}>
                  <h2 style={{ margin: 0, flex: 1 }}>
                    {selected.name} · {selected.size} stops
                  </h2>
                  {selected.active ? (
                    <button className="btn red" type="button" disabled={busy} onClick={archiveBeat}>
                      Archive
                    </button>
                  ) : null}
                </div>
                <div className="list">
                  {selected.members.map((stop, index) => (
                    <article key={stop.id} className="card person">
                      <div>
                        <strong>
                          {stop.sequence}. {stop.name}
                        </strong>
                        <div className="muted">{[stop.phone, stop.city].filter(Boolean).join(" · ") || "—"}</div>
                      </div>
                      <div className="seq-btns">
                        <button className="ghost" type="button" onClick={() => moveMember(index, -1)} disabled={index === 0 || busy}>
                          Up
                        </button>
                        <button
                          className="ghost"
                          type="button"
                          onClick={() => moveMember(index, 1)}
                          disabled={index === selected.members.length - 1 || busy}
                        >
                          Down
                        </button>
                        <button className="link" type="button" onClick={() => removeMember(stop.id)} disabled={busy}>
                          Remove
                        </button>
                      </div>
                    </article>
                  ))}
                  {!selected.members.length ? <p className="muted">Add approved leads or customers below.</p> : null}
                </div>

                <h2>Add a stop</h2>
                <input
                  className="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search lead or customer"
                />
                <div className="list">
                  {available.slice(0, 12).map((place) => (
                    <article key={`${place.kind}-${place.id}`} className="card person">
                      <div>
                        <strong>{place.name}</strong>
                        <div className="muted">
                          {place.kind === "lead" ? "Lead" : "Customer"} · {place.phone}
                          {place.city ? ` · ${place.city}` : ""}
                        </div>
                      </div>
                      <button className="btn green" type="button" disabled={busy} onClick={() => addPlace(place)}>
                        Add
                      </button>
                    </article>
                  ))}
                  {!available.length ? <p className="muted">Everyone matching is already on this beat.</p> : null}
                </div>
              </>
            ) : null}
          </section>
        ) : (
          <section>
            <h2>Schedule · {people.find((p) => p.userId === userId)?.name ?? "Pick someone"}</h2>
            <p className="muted">
              Set cycle length (e.g. 15 / 20 / 30 days) and start date. Day 1 of the cycle repeats after the last day.
              Leave a day Off if they should not run a beat that day.
            </p>
            <div className="toolbar">
              <label className="muted">
                Cycle days{" "}
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={cycleLength}
                  onChange={(e) => resizeCycle(Number(e.target.value))}
                  style={{ width: 72 }}
                />
              </label>
              {CYCLE_PRESETS.map((n) => (
                <button
                  key={n}
                  className={`btn ${cycleLength === n ? "blue" : ""}`}
                  type="button"
                  onClick={() => resizeCycle(n)}
                >
                  {n}d
                </button>
              ))}
              <label className="muted">
                Start{" "}
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </label>
            </div>
            {todayIndex != null ? (
              <p className="on">
                Today is day {todayIndex + 1} of {cycleLength} in this cycle
                {days[todayIndex]?.beatName ? ` → ${days[todayIndex]?.beatName}` : " → Off"}.
              </p>
            ) : (
              <p className="muted">Today is before the cycle start date — no beat until start.</p>
            )}
            {!personBeats.length ? (
              <p className="error">Create at least one active beat for this salesperson first.</p>
            ) : (
              <div className="list">
                {Array.from({ length: cycleLength }, (_, dayIndex) => (
                  <article
                    key={dayIndex}
                    className={`card person ${todayIndex === dayIndex ? "picked" : ""}`}
                  >
                    <div style={{ minWidth: 110 }}>
                      <strong>Day {dayIndex + 1}</strong>
                      <div className="muted small">{dateForDayIndex(startDate, dayIndex)}</div>
                    </div>
                    <select
                      value={days[dayIndex]?.beatId ?? ""}
                      onChange={(e) => setDayBeat(dayIndex, e.target.value ? Number(e.target.value) : null)}
                      style={{ flex: 1 }}
                    >
                      <option value="">Off</option>
                      {personBeats.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.size})
                        </option>
                      ))}
                    </select>
                  </article>
                ))}
              </div>
            )}
            <div className="toolbar" style={{ marginTop: 12 }}>
              <button className="btn green" type="button" disabled={busy || !userId} onClick={saveSchedule}>
                Save schedule
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
