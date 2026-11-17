import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ExecFilter, type ExecValue } from "../components/ExecFilter";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

type PlanLead = {
  sequence: number;
  leadId: number | null;
  customerId: number | null;
  beatId?: number | null;
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
  /** True when this beat is on today’s plan (several beats can share today). */
  forToday?: boolean;
  leads: PlanShop[];
};

type PlanPerson = {
  userId: number;
  name: string;
  beatId: number | null;
  beatName: string | null;
  territory: string | null;
  todayBeatIds?: number[];
  beats: PlanBeat[];
  leads: PlanLead[];
  total: number;
  done: number;
  left: number;
};

type DeskBeat = {
  id: number;
  name: string;
  assigneeId: number | null;
  size: number;
  territory?: string | null;
};

type UnassignDraft = {
  person: PlanPerson;
  beats: DeskBeat[];
  selectedIds: number[];
  step: "pick" | "confirm";
  loading: boolean;
};

function execFromQuery(raw: string | null): ExecValue {
  if (!raw) return "all";
  const id = Number(raw);
  return id > 0 ? id : "all";
}

function stateLabel(state: PlanLead["state"]) {
  if (state === "done") return "Complete";
  if (state === "working") return "Working";
  return "Left";
}

/** Empty beats still assigned should not read as “0 shops on 2 beats”. */
function beatShopSummary(beats: PlanBeat[]) {
  const shops = beats.reduce((sum, beat) => sum + beat.shops, 0);
  const withShops = beats.filter((beat) => beat.shops > 0).length;
  const beatCount = shops > 0 ? withShops : 0;
  return { shops, beatCount };
}

export function VisitPlanPage() {
  const { accessToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [people, setPeople] = useState<PlanPerson[]>([]);
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [draft, setDraft] = useState<UnassignDraft | null>(null);
  /** Which beat’s shops are open in the person detail view. */
  const [viewBeatId, setViewBeatId] = useState<number | null>(null);
  const exec = execFromQuery(searchParams.get("userId"));

  const load = useCallback(() => {
    if (!accessToken) return;
    setError("");
    api<{ date: string; people: PlanPerson[] }>("/visit-plan", { token: accessToken })
      .then((data) => {
        setPeople(data.people);
        setDate(data.date);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the visit plan."));
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  function setExec(next: ExecValue) {
    const params = new URLSearchParams(searchParams);
    if (typeof next === "number") params.set("userId", String(next));
    else params.delete("userId");
    setSearchParams(params, { replace: true });
    setViewBeatId(null);
  }

  async function openUnassign(person: PlanPerson) {
    if (!accessToken) return;
    setError("");
    setNotice("");
    setDraft({
      person,
      beats: [],
      selectedIds: [],
      step: "pick",
      loading: true,
    });
    try {
      const deskBeats = await api<DeskBeat[]>(`/beats?assigneeId=${person.userId}`, { token: accessToken });
      const beats =
        deskBeats.length > 0
          ? deskBeats
          : person.beats.map((beat) => ({
              id: beat.id,
              name: beat.name,
              assigneeId: person.userId,
              size: beat.shops,
              territory: beat.territory,
            }));
      setDraft({
        person,
        beats,
        selectedIds: beats.map((beat) => beat.id),
        step: "pick",
        loading: false,
      });
    } catch (err) {
      setDraft(null);
      setError(err instanceof Error ? err.message : "Could not load beats for this salesperson.");
    }
  }

  function toggleBeat(id: number) {
    setDraft((current) => {
      if (!current) return current;
      const on = current.selectedIds.includes(id);
      return {
        ...current,
        selectedIds: on ? current.selectedIds.filter((item) => item !== id) : [...current.selectedIds, id],
      };
    });
  }

  function selectAllBeats() {
    setDraft((current) => (current ? { ...current, selectedIds: current.beats.map((beat) => beat.id) } : current));
  }

  function selectNoBeats() {
    setDraft((current) => (current ? { ...current, selectedIds: [] } : current));
  }

  async function confirmUnassign() {
    if (!accessToken || !draft || !draft.selectedIds.length) return;
    const { person, selectedIds, beats } = draft;
    const names = beats.filter((beat) => selectedIds.includes(beat.id)).map((beat) => beat.name);
    setBusyId(person.userId);
    setError("");
    setNotice("");
    try {
      for (const id of selectedIds) {
        await api(`/beats/${id}`, {
          method: "PATCH",
          token: accessToken,
          body: JSON.stringify({ assigneeId: null }),
        });
      }
      setNotice(
        `${person.name} is unassigned from ${selectedIds.length} beat${selectedIds.length === 1 ? "" : "s"}${
          names.length ? `: ${names.join(", ")}` : ""
        }.`,
      );
      setDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unassign the salesperson.");
    } finally {
      setBusyId(null);
    }
  }

  const selected = typeof exec === "number" ? people.find((person) => person.userId === exec) ?? null : null;
  const namedBeats = selected?.beats.filter((beat) => beat.shops > 0) ?? [];
  const todayIds = new Set(
    selected?.todayBeatIds?.length
      ? selected.todayBeatIds
      : namedBeats.filter((beat) => beat.forToday).map((beat) => beat.id),
  );
  const firstTodayId = namedBeats.find((beat) => todayIds.has(beat.id))?.id ?? null;
  const activeBeatId =
    viewBeatId && namedBeats.some((beat) => beat.id === viewBeatId)
      ? viewBeatId
      : firstTodayId && namedBeats.some((beat) => beat.id === firstTodayId)
        ? firstTodayId
        : namedBeats[0]?.id ?? null;
  const activeBeat = namedBeats.find((beat) => beat.id === activeBeatId) ?? null;
  const viewingToday = Boolean(activeBeat?.forToday || (activeBeatId && todayIds.has(activeBeatId)));
  const activeTodayLeads = viewingToday
    ? (() => {
        if (!activeBeat || !selected) return [];
        const fromStops = selected.leads.filter(
          (lead) =>
            lead.beatId === activeBeat.id ||
            activeBeat.leads.some(
              (shop) =>
                Boolean(lead.leadId && shop.leadId === lead.leadId) ||
                Boolean(lead.customerId && shop.customerId === lead.customerId),
            ),
        );
        if (fromStops.length) return fromStops;
        // Dates say today but stops not built yet — still show shops as Left.
        return activeBeat.leads.map((shop) => ({
          sequence: shop.sequence,
          leadId: shop.leadId,
          customerId: shop.customerId,
          beatId: activeBeat.id,
          name: shop.name,
          phone: shop.phone,
          city: shop.city,
          state: "left" as const,
        }));
      })()
    : [];
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
      {notice ? <p className="notice">{notice}</p> : null}

      {draft ? (
        <div className="plan-unassign-mask" role="dialog" aria-modal="true" aria-labelledby="unassign-title">
          <div className="card plan-unassign">
            {draft.step === "pick" ? (
              <>
                <h2 id="unassign-title" style={{ margin: 0 }}>
                  Unassign {draft.person.name}
                </h2>
                <p className="muted">
                  Choose one beat or all. The beats and shops stay. Only this salesperson is cleared from the ones you pick.
                </p>
                {draft.loading ? (
                  <p className="muted">Loading their beats…</p>
                ) : draft.beats.length ? (
                  <>
                    <div className="toolbar" style={{ marginTop: 0 }}>
                      <button className="btn" type="button" onClick={selectAllBeats}>
                        All beats
                      </button>
                      <button className="btn" type="button" onClick={selectNoBeats}>
                        Clear
                      </button>
                    </div>
                    <div className="list">
                      {draft.beats.map((beat) => {
                        const on = draft.selectedIds.includes(beat.id);
                        return (
                          <label key={beat.id} className="person stop-row plan-unassign-row">
                            <input type="checkbox" checked={on} onChange={() => toggleBeat(beat.id)} />
                            <span>
                              <strong>{beat.name}</strong>
                              <span className="muted">
                                {" · "}
                                {beat.size} shop{beat.size === 1 ? "" : "s"}
                                {beat.territory?.trim() ? ` · ${beat.territory.trim()}` : ""}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="muted">{draft.person.name} has no beats assigned.</p>
                )}
                <div className="toolbar" style={{ marginTop: 8 }}>
                  <button className="btn" type="button" onClick={() => setDraft(null)}>
                    Cancel
                  </button>
                  <button
                    className="btn red"
                    type="button"
                    disabled={!draft.selectedIds.length || draft.loading}
                    onClick={() => setDraft({ ...draft, step: "confirm" })}
                  >
                    Continue
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 id="unassign-title" style={{ margin: 0 }}>
                  Are you sure?
                </h2>
                <p className="muted">
                  Unassign <strong>{draft.person.name}</strong> from{" "}
                  <strong>
                    {draft.selectedIds.length} beat{draft.selectedIds.length === 1 ? "" : "s"}
                  </strong>
                  ?
                </p>
                <ul className="plan-unassign-list">
                  {draft.beats
                    .filter((beat) => draft.selectedIds.includes(beat.id))
                    .map((beat) => (
                      <li key={beat.id}>
                        {beat.name} · {beat.size} shop{beat.size === 1 ? "" : "s"}
                      </li>
                    ))}
                </ul>
                <p className="muted">This cannot be undone from here. You can assign them again on Beat desk.</p>
                <div className="toolbar" style={{ marginTop: 8 }}>
                  <button className="btn" type="button" disabled={busyId === draft.person.userId} onClick={() => setDraft({ ...draft, step: "pick" })}>
                    No
                  </button>
                  <button
                    className="btn red"
                    type="button"
                    disabled={busyId === draft.person.userId}
                    onClick={() => confirmUnassign()}
                  >
                    {busyId === draft.person.userId ? "Unassigning…" : "Yes, unassign"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

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
                  {(() => {
                    const { shops, beatCount } = beatShopSummary(selected.beats);
                    return (
                      <>
                        <strong>{shops}</strong> shops on {beatCount} beat{beatCount === 1 ? "" : "s"}
                      </>
                    );
                  })()}
                </span>
              )}
            </div>
            <button className="btn" type="button" disabled={busyId === selected.userId} onClick={() => openUnassign(selected)}>
              Unassign salesperson
            </button>
          </article>
          {namedBeats.length ? (
            <>
              <div className="chips">
                {namedBeats.map((beat) => (
                  <button
                    key={beat.id}
                    type="button"
                    className={beat.id === activeBeatId ? "chip on" : "chip"}
                    onClick={() => setViewBeatId(beat.id)}
                  >
                    {beat.name} · {beat.shops} shops
                    {todayIds.has(beat.id) ? " · today" : ""}
                  </button>
                ))}
              </div>
              {activeBeat ? (
                <section className="card">
                  <h2 style={{ margin: 0 }}>
                    {activeBeat.name}
                    {activeBeat.territory ? <span className="muted"> · {activeBeat.territory}</span> : null}
                  </h2>
                  <p className="muted">
                    {viewingToday
                      ? `${activeTodayLeads.length} leads today · ${activeTodayLeads.filter((l) => l.state === "done").length} done · ${activeTodayLeads.filter((l) => l.state !== "done").length} left`
                      : `${activeBeat.shops} shops · not planned for today`}
                  </p>
                  <div className="list">
                    {viewingToday
                      ? activeTodayLeads.map((lead) => {
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
                        })
                      : activeBeat.leads.map((lead) =>
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
                    {!viewingToday && !activeBeat.leads.length ? <p className="muted">No shops on this beat.</p> : null}
                    {viewingToday && !activeTodayLeads.length ? <p className="muted">No leads for this beat today yet — refresh after locking dates with OK.</p> : null}
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <p className="muted">No beats with shops assigned yet.</p>
          )}
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
            {people.map((person) => {
              const { shops, beatCount } = beatShopSummary(person.beats);
              const namedBeats = person.beats.filter((beat) => beat.shops > 0);
              return (
                <article key={person.userId} className="card plan-card">
                  <button type="button" className="plan-card-main" onClick={() => setExec(person.userId)}>
                    <strong>{person.name}</strong>
                    <div className="muted">{person.beatName ? person.beatName : "No beat today"}</div>
                    {namedBeats.length > 1 ? (
                      <div className="muted">{namedBeats.map((beat) => beat.name).join(" · ")}</div>
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
                        {shops} shops on {beatCount} beat{beatCount === 1 ? "" : "s"}
                      </div>
                    )}
                  </button>
                  <button className="btn" type="button" disabled={busyId === person.userId} onClick={() => openUnassign(person)}>
                    Unassign
                  </button>
                </article>
              );
            })}
          </div>
          {!people.length && !error ? <p className="muted">No salespeople yet. Add them on Team.</p> : null}
        </>
      )}
    </div>
  );
}
