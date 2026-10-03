import { useEffect, useState } from "react";
import { ExecFilter, useExecutives, type ExecValue } from "../components/ExecFilter";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { MapView } from "../components/MapView";
import type { FieldTeammate } from "../lib/types";

function age(seconds: number | null) {
  if (seconds == null) return "No GPS yet";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  return `${Math.round(seconds / 3600)} h ago`;
}

export function MapPage() {
  const { user, accessToken } = useAuth();
  const executives = useExecutives();
  const [people, setPeople] = useState<FieldTeammate[]>([]);
  const [exec, setExec] = useState<ExecValue>("all");
  const [error, setError] = useState("");

  async function load() {
    if (!accessToken) return;
    try {
      setPeople(await api<FieldTeammate[]>("/field/team", { token: accessToken }));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the team map.");
    }
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, [accessToken]);

  const liveOn = Boolean(user?.liveLocationEnabled);
  const visible = typeof exec === "number" ? people.filter((person) => person.userId === exec) : people;
  const pins = visible
    .filter((person) => person.liveStreaming && person.lastLat != null && person.lastLng != null)
    .map((person) => ({
      lat: person.lastLat as number,
      lng: person.lastLng as number,
      label: person.name,
      extra: age(person.lastSeenAgeSeconds),
    }));

  return (
    <div className="page wide">
      <h1>Live map</h1>
      <p className="muted">
        {liveOn
          ? "OpenStreetMap. Pins refresh every 30 seconds while a salesperson has started field work. All executives stay listed — pick one to focus the map."
          : "Live location is Off. Visit photos still prove the stop. Admin turns live On in Settings."}
      </p>
      <ExecFilter people={executives} value={exec} onChange={setExec} />
      {error ? <p className="error">{error}</p> : null}
      {liveOn ? <MapView pins={pins} height={520} /> : <div className="card muted">Map stays empty until live location is On.</div>}
      <div className="list">
        {visible.map((person) => (
          <article key={person.userId} className="card person">
            <div>
              <strong>{person.name}</strong>
              <div className="muted">
                {person.fieldStatus === "ACTIVE" ? `In field · ${person.durationMinutes} min` : "Not in field"}
                {person.lastSeenAt ? ` · ${age(person.lastSeenAgeSeconds)}` : ""}
              </div>
            </div>
            <span className={person.liveStreaming ? "on" : "off"}>
              {person.liveStreaming ? "Live" : liveOn ? "No stream" : "Live off"}
            </span>
          </article>
        ))}
      </div>
    </div>
  );
}
