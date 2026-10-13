import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ExecFilter, useExecutives, type ExecValue } from "../components/ExecFilter";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Visit } from "../lib/types";

type StatusFilter = "all" | "completed" | "missed" | "in_progress";

const statusOptions: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "completed", label: "Completed" },
  { id: "missed", label: "Missed" },
  { id: "in_progress", label: "In progress" },
];

function execFromQuery(raw: string | null): ExecValue {
  if (!raw) return "all";
  const id = Number(raw);
  return id > 0 ? id : "all";
}

function isoDay(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysAgo(days: number) {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return isoDay(value);
}

function visitKind(visit: Visit): Exclude<StatusFilter, "all"> {
  if (visit.status === "IN_PROGRESS") return "in_progress";
  return visit.outcome === "UNAVAILABLE" ? "missed" : "completed";
}

function stateLabel(visit: Visit) {
  if (visit.managerConfirmedAt) return "Confirmed";
  const kind = visitKind(visit);
  if (kind === "in_progress") return "In progress";
  if (kind === "missed") return "Missed";
  return "Completed";
}

export function VisitsPage() {
  const { accessToken } = useAuth();
  const people = useExecutives();
  const [searchParams, setSearchParams] = useSearchParams();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [error, setError] = useState("");
  const exec = execFromQuery(searchParams.get("userId"));
  const from = searchParams.get("from") || isoDay();
  const to = searchParams.get("to") || from;
  const status = (statusOptions.find((item) => item.id === searchParams.get("status"))?.id ?? "all") as StatusFilter;

  function setParam(changes: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  }

  function setExec(next: ExecValue) {
    setParam({ userId: typeof next === "number" ? String(next) : null });
  }

  useEffect(() => {
    if (!accessToken) return;
    const who = typeof exec === "number" ? `&userId=${exec}` : "";
    setError("");
    api<Visit[]>(`/visits?from=${from}&to=${to}${who}`, { token: accessToken })
      .then(setVisits)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load visits."));
  }, [accessToken, exec, from, to]);

  const counts: Record<StatusFilter, number> = { all: visits.length, completed: 0, missed: 0, in_progress: 0 };
  for (const visit of visits) counts[visitKind(visit)] += 1;
  const shown = status === "all" ? visits : visits.filter((visit) => visitKind(visit) === status);
  const today = isoDay();

  return (
    <div className="page">
      <h1>Visits</h1>
      <p className="muted">
        Place photo, GPS pin and time are the proof. Filter by executive, date and status to track completed visits.
      </p>
      <ExecFilter people={people} value={exec} onChange={setExec} />
      <div className="filters">
        <label>
          From
          <input type="date" value={from} max={today} onChange={(event) => setParam({ from: event.target.value || today })} />
        </label>
        <label>
          To
          <input type="date" value={to} min={from} max={today} onChange={(event) => setParam({ to: event.target.value || from })} />
        </label>
        <div className="quick">
          <button className="link" type="button" onClick={() => setParam({ from: today, to: today })}>
            Today
          </button>
          <button className="link" type="button" onClick={() => setParam({ from: daysAgo(1), to: daysAgo(1) })}>
            Yesterday
          </button>
          <button className="link" type="button" onClick={() => setParam({ from: daysAgo(6), to: today })}>
            Last 7 days
          </button>
          <button className="link" type="button" onClick={() => setParam({ from: daysAgo(29), to: today })}>
            Last 30 days
          </button>
        </div>
      </div>
      <div className="chips">
        {statusOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            className={status === option.id ? "chip on" : "chip"}
            onClick={() => setParam({ status: option.id === "all" ? null : option.id })}
          >
            {option.label} · {counts[option.id]}
          </button>
        ))}
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="list">
        {shown.map((visit) => (
          <article key={visit.id} className="card person">
            <div>
              <strong>{visit.name}</strong>
              <div className="muted">
                {visit.userName || "Sales"} · started {new Date(visit.checkedInAt).toLocaleString()}
                {visit.checkedOutAt ? ` · finished ${new Date(visit.checkedOutAt).toLocaleString()}` : ""}
              </div>
              <div className="muted">
                {visit.checkinDistanceMeters != null ? `Check-in ${visit.checkinDistanceMeters} m from pin` : "Check-in GPS saved"}
                {visit.finishDistanceMeters != null ? ` · Finish ${visit.finishDistanceMeters} m` : ""}
                {visit.hasPhoto ? " · Photo" : " · No photo"}
                {visit.saleAmount != null ? ` · Sale ₹${visit.saleAmount}` : ""}
              </div>
            </div>
            <div className="right">
              <span className={visitKind(visit) === "missed" ? "off" : visitKind(visit) === "completed" ? "on" : "muted"}>
                {stateLabel(visit)}
              </span>
              <Link to={`/visits/${visit.id}`}>Open proof</Link>
            </div>
          </article>
        ))}
        {!shown.length ? <p className="muted">No visits for these dates and this filter.</p> : null}
      </div>
    </div>
  );
}
