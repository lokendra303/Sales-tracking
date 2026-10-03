import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ExecFilter, useExecutives, type ExecValue } from "../components/ExecFilter";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Visit } from "../lib/types";

function execFromQuery(raw: string | null): ExecValue {
  if (!raw) return "all";
  const id = Number(raw);
  return id > 0 ? id : "all";
}

export function VisitsPage() {
  const { accessToken } = useAuth();
  const people = useExecutives();
  const [searchParams, setSearchParams] = useSearchParams();
  const [visits, setVisits] = useState<Visit[]>([]);
  const exec = execFromQuery(searchParams.get("userId"));

  function setExec(next: ExecValue) {
    const nextParams = new URLSearchParams(searchParams);
    if (next === "all" || next === "unassigned") nextParams.delete("userId");
    else nextParams.set("userId", String(next));
    setSearchParams(nextParams, { replace: true });
  }

  useEffect(() => {
    if (!accessToken) return;
    const qs = typeof exec === "number" ? `&userId=${exec}` : "";
    api<Visit[]>(`/visits?days=14${qs}`, { token: accessToken }).then(setVisits).catch(() => undefined);
  }, [accessToken, exec]);

  return (
    <div className="page">
      <h1>Visits</h1>
      <p className="muted">
        Place photo, GPS pin and time are the proof. Select an executive to review only their visits, or keep All
        executives to see the whole team.
      </p>
      <ExecFilter people={people} value={exec} onChange={setExec} />
      <div className="list">
        {visits.map((visit) => (
          <article key={visit.id} className="card person">
            <div>
              <strong>{visit.name}</strong>
              <div className="muted">
                {visit.userName || "Sales"} · {new Date(visit.checkedInAt).toLocaleString()}
                {visit.hasPhoto ? " · Photo" : " · No photo"}
                {visit.verified ? " · Verified" : ""}
                {visit.saleAmount != null ? ` · ₹${visit.saleAmount}` : ""}
              </div>
            </div>
            <div className="right">
              <span className={visit.managerConfirmedAt ? "on" : "muted"}>
                {visit.managerConfirmedAt ? "Confirmed" : visit.outcome || visit.status}
              </span>
              <Link to={`/visits/${visit.id}`}>Open proof</Link>
            </div>
          </article>
        ))}
        {!visits.length ? <p className="muted">No visits in the last 14 days for this view.</p> : null}
      </div>
    </div>
  );
}
