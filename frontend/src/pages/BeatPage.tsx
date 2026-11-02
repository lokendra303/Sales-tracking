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
  hqId?: number | null;
  repeatDays?: number[] | null;
  repeatEvery?: number | null;
  planDates?: string[];
  assigneeId: number | null;
  assigneeName: string | null;
  notes: string | null;
  size: number;
  members: Member[];
};
type Hq = { id: number; name: string; beatCount: number };
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
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatPlanDate(iso: string, withYear = false) {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" as const } : {}),
  });
}

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

function AssignmentCalendar({
  month,
  dates,
  onMonth,
  onToggle,
}: {
  month: Date;
  dates: string[];
  onMonth: (next: Date) => void;
  onToggle: (iso: string) => void;
}) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = new Date(year, monthIndex, 1);
  const pad = (first.getDay() + 6) % 7;
  const count = new Date(year, monthIndex + 1, 0).getDate();
  const today = isoToday();
  const cells: Array<{ iso: string; day: number } | null> = [];
  for (let i = 0; i < pad; i++) cells.push(null);
  for (let day = 1; day <= count; day++) {
    cells.push({
      iso: `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      day,
    });
  }
  return (
    <div className="cal">
      <div className="cal-head">
        <button className="btn" type="button" onClick={() => onMonth(new Date(year, monthIndex - 1, 1))}>
          Prev
        </button>
        <strong>{month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</strong>
        <button className="btn" type="button" onClick={() => onMonth(new Date(year, monthIndex + 1, 1))}>
          Next
        </button>
      </div>
      <div className="cal-grid cal-names">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>
      <div className="cal-grid">
        {cells.map((cell, index) =>
          cell ? (
            <button
              key={cell.iso}
              type="button"
              className={`cal-day${dates.includes(cell.iso) ? " on" : ""}${cell.iso === today ? " today" : ""}`}
              onClick={() => onToggle(cell.iso)}
            >
              {cell.day}
            </button>
          ) : (
            <span key={`pad-${index}`} />
          ),
        )}
      </div>
    </div>
  );
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
  const [hqs, setHqs] = useState<Hq[]>([]);
  const [hqDraft, setHqDraft] = useState("");
  const [hqChoice, setHqChoice] = useState<string>("");
  const [newHqName, setNewHqName] = useState("");
  const [planDays, setPlanDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);
  const [repeatEvery, setRepeatEvery] = useState(7);
  const [planDates, setPlanDates] = useState<string[]>([]);
  const [calMonth, setCalMonth] = useState(() => new Date());
  const [hqFilter, setHqFilter] = useState<"all" | "none" | string>("all");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = beats.find((b) => b.id === selectedBeatId) ?? null;

  const matchesHq = (beat: Beat) => {
    if (hqFilter === "all") return true;
    if (hqFilter === "none") return !beat.hqId;
    return beat.hqId === Number(hqFilter);
  };

  const personBeats = useMemo(
    () => beats.filter((b) => b.assigneeId === userId && matchesHq(b)),
    // matchesHq closes over hqFilter
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [beats, userId, hqFilter],
  );

  const listedBeats = useMemo(
    () => beats.filter((b) => matchesHq(b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [beats, hqFilter],
  );

  const dateRows = useMemo(() => {
    const rows: { iso: string; beatId: number; beatName: string; person: string; hq: string }[] = [];
    for (const beat of listedBeats) {
      for (const iso of beat.planDates ?? []) {
        rows.push({
          iso,
          beatId: beat.id,
          beatName: beat.name,
          person: beat.assigneeName ?? "No salesperson",
          hq: beat.territory || "No HQ",
        });
      }
    }
    rows.sort((a, b) => a.iso.localeCompare(b.iso) || a.beatName.localeCompare(b.beatName));
    return rows;
  }, [listedBeats]);

  useEffect(() => {
    if (selectedBeatId && !listedBeats.some((b) => b.id === selectedBeatId)) {
      setSelectedBeatId(listedBeats[0]?.id ?? null);
    }
  }, [listedBeats, selectedBeatId]);

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

  async function loadHqs() {
    if (!accessToken) return;
    const data = await api<Hq[]>("/hqs", { token: accessToken });
    setHqs(data);
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
    Promise.all([loadPeople(), loadBeats(), loadPlaces(), loadHqs()]).catch((err) =>
      setError(err instanceof Error ? err.message : "Could not load."),
    );
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !userId) return;
    loadSchedule(userId).catch(() => undefined);
  }, [accessToken, userId]);

  useEffect(() => {
    const every = selected?.repeatEvery && selected.repeatEvery >= 2 ? selected.repeatEvery : 7;
    setRepeatEvery(every);
    setPlanDays(selected?.repeatDays?.length ? selected.repeatDays : every === 7 ? [1, 2, 3, 4, 5, 6, 0] : [0]);
    setPlanDates(selected?.planDates ?? []);
  }, [selected?.id, selected?.repeatDays, selected?.repeatEvery, selected?.planDates]);

  async function addHq() {
    if (!accessToken || !hqDraft.trim()) return;
    setBusy(true);
    setError("");
    try {
      const data = await api<Hq>("/hqs", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ name: hqDraft.trim() }),
      });
      setHqDraft("");
      setHqChoice(String(data.id));
      setHqFilter(String(data.id));
      setNotice(`HQ “${data.name}” is ready. Create a beat under it.`);
      await loadHqs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add HQ.");
    } finally {
      setBusy(false);
    }
  }

  async function createBeat() {
    if (!accessToken || !newName.trim()) return;
    if (!hqChoice) {
      setError("Select an HQ, or add a new one.");
      return;
    }
    if (hqChoice === "new" && !newHqName.trim()) {
      setError("Enter the new HQ name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await api<Beat>("/beats", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          name: newName.trim(),
          ...(hqChoice === "new" ? { hqName: newHqName.trim() } : { hqId: Number(hqChoice) }),
        }),
      });
      setNewName("");
      setNewHqName("");
      setNotice(`Created “${data.name}”. Add the shops below, then assign a salesperson.`);
      await Promise.all([loadBeats(), loadHqs()]);
      setSelectedBeatId(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create beat.");
    } finally {
      setBusy(false);
    }
  }

  async function assignBeat(assigneeId: number | null) {
    if (!accessToken || !selected) return;
    setBusy(true);
    setError("");
    try {
      await api(`/beats/${selected.id}`, {
        method: "PATCH",
        token: accessToken,
        body: JSON.stringify({ assigneeId }),
      });
      setNotice(assigneeId ? "Salesperson assigned. Save the repeating plan so it becomes their daily task." : "Beat is unassigned.");
      await loadBeats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign the salesperson.");
    } finally {
      setBusy(false);
    }
  }

  async function saveRepeat() {
    if (!accessToken || !selected) return;
    setBusy(true);
    setError("");
    try {
      const data = await api<Beat>(`/beats/${selected.id}/repeat`, {
        method: "PUT",
        token: accessToken,
        body: JSON.stringify({ weekdays: planDays.filter((day) => day < repeatEvery), every: repeatEvery }),
      });
      const who = data.assigneeName ?? "The salesperson";
      const cycle = data.repeatEvery && data.repeatEvery >= 2 ? data.repeatEvery : 7;
      setNotice(
        !data.repeatDays?.length
          ? "Daily plan cleared."
          : cycle === 7
            ? `${who} gets “${data.name}” on the selected days every week. It shows up as today’s beat on its own.`
            : data.repeatDays.length === 1 && data.repeatDays[0] === 0
              ? `${who} gets “${data.name}” every ${cycle} days. It shows up as today’s beat on its own.`
              : `${who} gets “${data.name}” on the selected days of every ${cycle} days.`,
      );
      await loadBeats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the daily plan.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDates() {
    if (!accessToken || !selected) return;
    setBusy(true);
    setError("");
    try {
      const data = await api<Beat>(`/beats/${selected.id}/dates`, {
        method: "PUT",
        token: accessToken,
        body: JSON.stringify({ dates: planDates }),
      });
      const who = data.assigneeName ?? "The salesperson";
      setNotice(
        data.planDates?.length
          ? `${who} gets “${data.name}” on ${data.planDates.length} picked date${data.planDates.length === 1 ? "" : "s"}.`
          : "Date plan cleared.",
      );
      setPlanDates(data.planDates ?? []);
      await loadBeats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the date plan.");
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
        Add an HQ, create a beat under it, then add the shops and assign a salesperson.
        Pick any cycle from 2 to 30 days. The phone shows that beat as today’s task on the chosen days. You do not set it again each morning.
      </p>

      <div className="toolbar">
        <button className={`btn ${tab === "beats" ? "blue" : ""}`} type="button" onClick={() => setTab("beats")}>
          Permanent beats
        </button>
        <button className={`btn ${tab === "schedule" ? "blue" : ""}`} type="button" onClick={() => setTab("schedule")}>
          Dynamic schedule
        </button>
      </div>

      <h2>Headquarters</h2>
      <div className="toolbar">
        <input
          value={hqDraft}
          onChange={(e) => setHqDraft(e.target.value)}
          placeholder="New HQ e.g. New Delhi"
          style={{ flex: 1, minWidth: 180 }}
        />
        <button className="btn" type="button" disabled={busy || !hqDraft.trim()} onClick={addHq}>
          Add HQ
        </button>
        <select value={hqFilter} onChange={(e) => setHqFilter(e.target.value)} style={{ minWidth: 220 }}>
          <option value="all">All HQ · {beats.length} beats</option>
          {hqs.map((hq) => (
            <option key={hq.id} value={hq.id}>
              {hq.name} · {hq.beatCount} beat{hq.beatCount === 1 ? "" : "s"}
            </option>
          ))}
        </select>
      </div>
      {!hqs.length ? <p className="muted">No HQ yet. Add one above, then create beats under it.</p> : null}
      {notice ? <p className="on">{notice}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {tab === "beats" ? (
          <section>
            <h2>Create beat</h2>
            <p className="muted">Name the beat and choose its HQ. Shops are added on the beat after it exists.</p>
            <div className="toolbar">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Beat name e.g. Beat 1"
                style={{ flex: 1, minWidth: 140 }}
              />
              <select value={hqChoice} onChange={(e) => setHqChoice(e.target.value)} style={{ minWidth: 160 }}>
                <option value="">Select HQ</option>
                {hqs.map((hq) => (
                  <option key={hq.id} value={hq.id}>
                    {hq.name}
                  </option>
                ))}
                <option value="new">Add new HQ</option>
              </select>
              {hqChoice === "new" ? (
                <input
                  value={newHqName}
                  onChange={(e) => setNewHqName(e.target.value)}
                  placeholder="New HQ name"
                  style={{ flex: 1, minWidth: 140 }}
                />
              ) : null}
              <button className="btn green" type="button" disabled={busy || !newName.trim()} onClick={createBeat}>
                Create
              </button>
            </div>
            <h2>
              Beats
              {hqFilter !== "all" ? (
                <span className="muted"> · {hqFilter === "none" ? "No HQ" : hqs.find((hq) => String(hq.id) === hqFilter)?.name}</span>
              ) : null}
            </h2>
            <div className="list">
              {listedBeats.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={`card person pick ${selectedBeatId === b.id ? "picked" : ""}`}
                    onClick={() => setSelectedBeatId(b.id)}
                  >
                    <div>
                      <strong>
                        {b.name}
                      </strong>
                      <div className="muted">
                        {b.assigneeName ?? "No salesperson"} · {b.territory || "No HQ"} · {b.size} stops
                      </div>
                      <div className="muted">
                        {b.planDates?.length
                          ? `Dates: ${b.planDates.slice(0, 4).map((iso) => formatPlanDate(iso)).join(", ")}${b.planDates.length > 4 ? ` +${b.planDates.length - 4} more` : ""}`
                          : "No calendar dates"}
                      </div>
                    </div>
                  </button>
                ))}
              {!listedBeats.length ? (
                <p className="muted">
                  {hqFilter === "all"
                    ? "No beats yet. Create one above."
                    : `No beats for ${hqFilter === "none" ? "No HQ" : hqs.find((hq) => String(hq.id) === hqFilter)?.name ?? "this HQ"}. Pick another HQ or create a beat.`}
                </p>
              ) : null}
            </div>

            <h2>Who gets which beat</h2>
            <p className="muted">
              Each row is one saved date: the day, the beat, and the salesperson. Click a row to open that beat.
            </p>
            <div className="list plan-list">
              {dateRows.map((row) => (
                <button
                  key={`${row.beatId}-${row.iso}`}
                  type="button"
                  className={`card person pick ${selectedBeatId === row.beatId ? "picked" : ""}`}
                  onClick={() => {
                    setSelectedBeatId(row.beatId);
                    const [year, month] = row.iso.split("-").map(Number);
                    if (year && month) setCalMonth(new Date(year, month - 1, 1));
                  }}
                >
                  <div>
                    <strong>{formatPlanDate(row.iso, true)}</strong>
                    <div className="muted">
                      {row.beatName} · {row.hq}
                    </div>
                  </div>
                  <strong>{row.person}</strong>
                </button>
              ))}
              {!dateRows.length ? (
                <p className="muted">No dates saved yet. Open a beat, pick days on the calendar, then save the assignment plan.</p>
              ) : null}
            </div>

            {selected ? (
              <>
                <div className="toolbar" style={{ marginTop: 16 }}>
                  <h2 style={{ margin: 0, flex: 1 }}>
                    {selected.name} · {selected.size} stops · {selected.territory || "No HQ"}
                  </h2>
                </div>
                <div className="toolbar">
                  <label className="muted">
                    Salesperson{" "}
                    <select
                      value={selected.assigneeId ?? ""}
                      onChange={(e) => assignBeat(e.target.value ? Number(e.target.value) : null)}
                      disabled={busy}
                    >
                      <option value="">Not assigned</option>
                      {people.map((person) => (
                        <option key={person.userId} value={person.userId}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="muted">
                  Repeating plan. Choose 2 to 30 days. The selected days come back after that many days, so you do not assign the beat again.
                </p>
                <div className="toolbar">
                  <label className="muted">
                    Repeat every{" "}
                    <input
                      type="number"
                      min={2}
                      max={30}
                      value={repeatEvery}
                      disabled={busy}
                      onChange={(e) => {
                        const next = Math.min(30, Math.max(2, Number(e.target.value) || 2));
                        setRepeatEvery(next);
                        setPlanDays(next === 7 ? [1, 2, 3, 4, 5, 6, 0] : [0]);
                      }}
                      style={{ width: 72 }}
                    />{" "}
                    days
                  </label>
                  {[7, 15, 30].map((count) => (
                    <button
                      key={count}
                      className={`btn ${repeatEvery === count ? "blue" : ""}`}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setRepeatEvery(count);
                        setPlanDays(count === 7 ? [1, 2, 3, 4, 5, 6, 0] : [0]);
                      }}
                    >
                      {count}d
                    </button>
                  ))}
                </div>
                <div className="chips">
                  {repeatEvery === 7
                    ? DAY_ORDER.map((day) => (
                        <button
                          key={day}
                          type="button"
                          className={planDays.includes(day) ? "chip on" : "chip"}
                          onClick={() =>
                            setPlanDays((current) =>
                              current.includes(day) ? current.filter((item) => item !== day) : [...current, day],
                            )
                          }
                        >
                          {DAY_LABEL[day]}
                        </button>
                      ))
                    : Array.from({ length: repeatEvery }, (_, index) => (
                        <button
                          key={index}
                          type="button"
                          className={planDays.includes(index) ? "chip on" : "chip"}
                          onClick={() =>
                            setPlanDays((current) =>
                              current.includes(index) ? current.filter((item) => item !== index) : [...current, index],
                            )
                          }
                        >
                          {index + 1}
                        </button>
                      ))}
                  <button className="btn green" type="button" disabled={busy || !selected.assigneeId} onClick={saveRepeat}>
                    Save repeating plan
                  </button>
                </div>
                <p className="muted">
                  {selected.assigneeName
                    ? `These dates assign “${selected.name}” to ${selected.assigneeName}. A saved date is used instead of the repeating plan.`
                    : `These dates are for “${selected.name}”. Choose a salesperson above before you can save them.`}
                </p>
                <AssignmentCalendar
                  month={calMonth}
                  dates={planDates}
                  onMonth={setCalMonth}
                  onToggle={(iso) =>
                    setPlanDates((current) =>
                      current.includes(iso) ? current.filter((day) => day !== iso) : [...current, iso].sort(),
                    )
                  }
                />
                {planDates.length ? (
                  <div className="chips">
                    {planDates.map((iso) => (
                      <button key={iso} type="button" className="chip on" onClick={() => setPlanDates((current) => current.filter((day) => day !== iso))}>
                        {formatPlanDate(iso, true)} · {selected.name} · {selected.assigneeName ?? "No salesperson"}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No dates yet. Click a day on the calendar.</p>
                )}
                <div className="toolbar">
                  <button className="btn green" type="button" disabled={busy || !selected.assigneeId} onClick={saveDates}>
                    Save assignment plan
                  </button>
                  <span className="muted">
                    {selected.assigneeId
                      ? planDates.length
                        ? `${planDates.length} date${planDates.length === 1 ? "" : "s"} selected. A picked date is used instead of the repeating plan.`
                        : "Save with no dates to clear this plan."
                      : "Assign a salesperson before saving dates."}
                  </span>
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
            <h2>Schedule</h2>
            <p className="muted">
              The repeating plan on a beat already repeats every 2 to 30 days. Saving a different cycle here replaces that plan.
            </p>
            <label className="muted">
              Salesperson{" "}
              <select value={userId ?? ""} onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Select a salesperson</option>
                {people.map((person) => (
                  <option key={person.userId} value={person.userId}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
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
              <p className="error">Create at least one beat for this salesperson first.</p>
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
  );
}
