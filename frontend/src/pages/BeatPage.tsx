import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

type Person = { userId: number; name: string; stopCount: number };
type Stop = {
  id: number;
  sequence: number;
  leadId: number | null;
  customerId: number | null;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
};
type Plan = { date: string; userId: number; userName: string; planned: boolean; stops: Stop[] };
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

function isoDay(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDay(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const next = new Date(year, month - 1, day);
  next.setDate(next.getDate() + days);
  return isoDay(next);
}

export function BeatPage() {
  const { accessToken } = useAuth();
  const today = isoDay();
  const [date, setDate] = useState(shiftDay(today, 1));
  const [people, setPeople] = useState<Person[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [q, setQ] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const taken = useMemo(() => {
    const keys = new Set<string>();
    for (const stop of plan?.stops ?? []) {
      if (stop.leadId) keys.add(`lead:${stop.leadId}`);
      if (stop.customerId) keys.add(`customer:${stop.customerId}`);
    }
    return keys;
  }, [plan]);

  const available = places.filter((place) => {
    if (place.status === "LOST") return false;
    if (place.kind === "lead" && place.approvalStatus && place.approvalStatus !== "APPROVED") return false;
    if (taken.has(`${place.kind}:${place.id}`)) return false;
    if (place.kind === "lead" && userId && place.assigneeId && place.assigneeId !== userId) return false;
    if (!q.trim()) return true;
    const hay = `${place.name} ${place.phone} ${place.city ?? ""}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  async function loadOverview() {
    if (!accessToken) return;
    const data = await api<{ date: string; people: Person[] }>(`/beat?date=${date}`, { token: accessToken });
    setPeople(data.people ?? []);
    if (userId && !data.people.some((person) => person.userId === userId)) {
      setUserId(data.people[0]?.userId ?? null);
    } else if (!userId && data.people[0]) {
      setUserId(data.people[0].userId);
    }
  }

  async function loadPlan(id = userId) {
    if (!accessToken || !id) {
      setPlan(null);
      return;
    }
    const data = await api<Plan>(`/beat?date=${date}&userId=${id}`, { token: accessToken });
    setPlan(data);
  }

  async function loadPlaces() {
    if (!accessToken) return;
    const data = await api<{ leads: Place[]; customers: Place[] }>("/leads", { token: accessToken });
    setPlaces([
      ...data.leads.map((lead) => ({ ...lead, kind: "lead" as const })),
      ...data.customers.map((customer) => ({ ...customer, kind: "customer" as const })),
    ]);
  }

  useEffect(() => {
    loadOverview().catch(() => undefined);
    loadPlaces().catch(() => undefined);
  }, [accessToken, date]);

  useEffect(() => {
    loadPlan().catch(() => undefined);
  }, [accessToken, date, userId]);

  async function addPlace(place: Place) {
    if (!accessToken || !userId) return;
    setError("");
    try {
      await api("/beat/stops", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          userId,
          date,
          leadId: place.kind === "lead" ? place.id : undefined,
          customerId: place.kind === "customer" ? place.id : undefined,
        }),
      });
      setNotice(`Added ${place.name}.`);
      await Promise.all([loadPlan(), loadOverview()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add.");
    }
  }

  async function removeStop(id: number) {
    if (!accessToken) return;
    await api(`/beat/stops/${id}`, { method: "DELETE", token: accessToken });
    await Promise.all([loadPlan(), loadOverview()]);
  }

  async function move(index: number, dir: -1 | 1) {
    if (!accessToken || !userId || !plan) return;
    const next = [...plan.stops];
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    await api("/beat/reorder", {
      method: "POST",
      token: accessToken,
      body: JSON.stringify({ userId, date, stopIds: next.map((stop) => stop.id) }),
    });
    await loadPlan();
  }

  async function copyFromToday() {
    if (!accessToken || !userId) return;
    setError("");
    try {
      await api("/beat/copy", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ fromUserId: userId, fromDate: today, toUserId: userId, toDate: date }),
      });
      setNotice("Copied today’s beat.");
      await Promise.all([loadPlan(), loadOverview()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not copy.");
    }
  }

  return (
    <div className="page wide">
      <p className="kicker">Field plan</p>
      <h1>Beat desk</h1>
      <p className="muted">Plan tomorrow’s list for each salesperson. They see it on the phone. No live tracking here.</p>

      <div className="toolbar">
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <button className="btn blue" type="button" onClick={() => setDate(shiftDay(today, 1))}>
          Tomorrow
        </button>
        <button className="link" type="button" onClick={() => setDate(today)}>
          Today
        </button>
        {date !== today ? (
          <button className="btn green" type="button" onClick={copyFromToday} disabled={!userId}>
            Copy today → this day
          </button>
        ) : null}
      </div>
      {notice ? <p className="muted">{notice}</p> : null}
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
                  <div className="muted">{person.stopCount ? `${person.stopCount} stops` : "Not planned"}</div>
                </div>
              </button>
            ))}
            {!people.length ? <p className="muted">No sales executives yet.</p> : null}
          </div>
        </section>

        <section>
          <h2>{plan ? `${plan.userName} · ${plan.stops.length} stops` : "Pick someone"}</h2>
          <div className="list">
            {(plan?.stops ?? []).map((stop, index) => (
              <article key={stop.id} className="card person">
                <div>
                  <strong>
                    {stop.sequence}. {stop.name}
                  </strong>
                  <div className="muted">
                    {[stop.phone, stop.city || stop.address].filter(Boolean).join(" · ") || "No address"}
                  </div>
                </div>
                <div className="seq-btns">
                  <button className="ghost" type="button" onClick={() => move(index, -1)} disabled={index === 0}>
                    Up
                  </button>
                  <button className="ghost" type="button" onClick={() => move(index, 1)} disabled={index === plan!.stops.length - 1}>
                    Down
                  </button>
                  <button className="link" type="button" onClick={() => removeStop(stop.id)}>
                    Remove
                  </button>
                </div>
              </article>
            ))}
            {plan && !plan.stops.length ? <p className="muted">No stops yet. Add a lead or customer, or copy today.</p> : null}
          </div>

          <h2>Add a stop</h2>
          <input className="search" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search lead or customer" />
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
                <button className="btn green" type="button" onClick={() => addPlace(place)}>
                  Add
                </button>
              </article>
            ))}
            {!available.length ? <p className="muted">Everyone on this list is already on the beat.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
