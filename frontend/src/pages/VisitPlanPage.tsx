import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ExecFilter, type ExecValue } from "../components/ExecFilter";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

type PlanLead = {
  sequence: number;
  leadId: number | null;
  customerId: number | null;
  name: string;
  phone: string | null;
  city: string | null;
  state: "done" | "working" | "left";
};

type PlanShop = {
  sequence: number;
  leadId: number | null;
  customerId: number | null;
  name: string;
  phone: string | null;
  city: string | null;
};

type PlanBeat = {
  id: number;
  name: string;
  territory: string | null;
  shops: number;
  leads: PlanShop[];
};

type PlanPerson = {
  userId: number;
  name: string;
  beatId: number | null;
  beatName: string | null;
  territory: string | null;
  beats: PlanBeat[];
  leads: PlanLead[];
  total: number;
  done: number;
  left: number;
};

function execFromQuery(raw: string | null): ExecValue {
  if (!raw) return "all";
  const id = Number(raw);
  return id > 0 ? id : "all";
}

function stateLabel(state: PlanLead["state"]) {
  if (state === "done") return "Done";
  if (state === "working") return "Working";
  return "Left";
}

export function VisitPlanPage() {
  const { accessToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [people, setPeople] = useState<PlanPerson[]>([]);
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const exec = execFromQuery(searchParams.get("userId"));

  useEffect(() => {
    if (!accessToken) return;
    setError("");
    api<{ date: string; people: PlanPerson[] }>("/visit-plan", { token: accessToken })
      .then((data) => {
        setPeople(data.people);
        setDate(data.date);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the visit plan."));
  }, [accessToken]);

  function setExec(next: ExecValue) {
    const params = new URLSearchParams(searchParams);
    if (typeof next === "number") params.set("userId", String(next));
    else params.delete("userId");
    setSearchParams(params, { replace: true });
  }

  const selected = typeof exec === "number" ? people.find((person) => person.userId === exec) ?? null : null;
  const totals = people.reduce(
    (sum, person) => ({
      leads: sum.leads + person.total,
      done: sum.done + person.done,
      left: sum.left + person.left,
    }),
    { leads: 0, done: 0, left: 0 },
  );
  const dayLabel = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : "Today";

  return (
    <div className="page wide">
      <p className="kicker">Today · {dayLabel}</p>
      <h1>Visit plan</h1>
      <p className="muted">
        Everyone on the team, the beat they are on today, and how many leads are done or still left. Open one person to see their leads alone.
      </p>
      <ExecFilter
        people={people.map((person) => ({ id: person.userId, name: person.name }))}
        value={exec}
        onChange={setExec}
      />
      {error ? <p className="error">{error}</p> : null}

      {selected ? (
        <section>
          <article className="card plan-summary">
            <div>
              <h2 style={{ margin: 0 }}>{selected.name}</h2>
              <p className="muted">
                {selected.beatName ? `${selected.beatName}${selected.territory ? ` · ${selected.territory}` : ""}` : "No beat planned today"}
              </p>
            </div>
            <div className="plan-counts">
              {selected.total ? (
                <>
                  <span>
                    <strong>{selected.total}</strong> leads
                  </span>
                  <span className="on">
                    <strong>{selected.done}</strong> done
                  </span>
                  <span>
                    <strong>{selected.left}</strong> left
                  </span>
                </>
              ) : (
                <span>
                  <strong>{selected.beats.reduce((sum, beat) => sum + beat.shops, 0)}</strong> shops on their beats
                </span>
              )}
            </div>
          </article>
          {selected.beats.length ? (
            selected.leads.length ? (
              <div className="chips">
                {selected.beats.map((beat) => (
                  <span key={beat.id} className={beat.id === selected.beatId ? "chip on" : "chip"}>
                    {beat.name} · {beat.shops} shops
                  </span>
                ))}
              </div>
            ) : (
              <div className="list">
                {selected.beats.map((beat) => (
                  <section key={beat.id} className="card">
                    <h2 style={{ margin: 0 }}>
                      {beat.name}
                      {beat.territory ? <span className="muted"> · {beat.territory}</span> : null}
                    </h2>
                    <p className="muted">{beat.shops} shops · not planned for today</p>
                    <div className="list">
                      {beat.leads.map((lead) =>
                        lead.leadId ? (
                          <Link key={lead.leadId} to={`/leads/${lead.leadId}`} className="person stop-row">
                            <strong>
                              {lead.sequence}. {lead.name}
                            </strong>
                            <span className="muted">{[lead.phone, lead.city].filter(Boolean).join(" · ") || "No phone"}</span>
                          </Link>
                        ) : (
                          <div key={`${lead.customerId}-${lead.sequence}`} className="person stop-row">
                            <strong>
                              {lead.sequence}. {lead.name}
                            </strong>
                            <span className="muted">{[lead.phone, lead.city].filter(Boolean).join(" · ") || "No phone"}</span>
                          </div>
                        ),
                      )}
                      {!beat.leads.length ? <p className="muted">No shops on this beat.</p> : null}
                    </div>
                  </section>
                ))}
              </div>
            )
          ) : (
            <p className="muted">No beats assigned yet.</p>
          )}
          {selected.leads.length ? (
          <div className="list">
            {selected.leads.map((lead) => {
              const body = (
                <>
                  <div>
                    <strong>
                      {lead.sequence}. {lead.name}
                    </strong>
                    <div className="muted">{[lead.phone, lead.city].filter(Boolean).join(" · ") || "No phone"}</div>
                  </div>
                  <span className={`pill ${lead.state}`}>{stateLabel(lead.state)}</span>
                </>
              );
              return lead.leadId ? (
                <Link key={`${lead.leadId}-${lead.sequence}`} to={`/leads/${lead.leadId}`} className="card person stop-row">
                  {body}
                </Link>
              ) : (
                <article key={`${lead.customerId}-${lead.sequence}`} className="card person stop-row">
                  {body}
                </article>
              );
            })}
          </div>
          ) : null}
        </section>
      ) : (
        <>
          <div className="plan-counts" style={{ margin: "8px 0 16px" }}>
            <span>
              <strong>{people.length}</strong> people
            </span>
            <span>
              <strong>{totals.leads}</strong> leads today
            </span>
            <span className="on">
              <strong>{totals.done}</strong> done
            </span>
            <span>
              <strong>{totals.left}</strong> left
            </span>
          </div>
          <div className="plan-grid">
            {people.map((person) => (
              <button key={person.userId} type="button" className="card plan-card" onClick={() => setExec(person.userId)}>
                <strong>{person.name}</strong>
                <div className="muted">{person.beatName ? person.beatName : "No beat today"}</div>
                {person.beats.length > 1 ? (
                  <div className="muted">{person.beats.map((beat) => beat.name).join(" · ")}</div>
                ) : null}
                {person.total ? (
                  <div className="plan-counts">
                    <span>
                      <strong>{person.total}</strong> leads
                    </span>
                    <span className="on">
                      <strong>{person.done}</strong> done
                    </span>
                    <span>
                      <strong>{person.left}</strong> left
                    </span>
                  </div>
                ) : (
                  <div className="muted">
                    {person.beats.reduce((sum, beat) => sum + beat.shops, 0)} shops on {person.beats.length} beat
                    {person.beats.length === 1 ? "" : "s"}
                  </div>
                )}
              </button>
            ))}
          </div>
          {!people.length && !error ? <p className="muted">No salespeople yet. Add them on Team.</p> : null}
        </>
      )}
    </div>
  );
}
