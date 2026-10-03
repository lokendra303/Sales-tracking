import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { API_BASE, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Funnel, TeamReport, TargetRow } from "../lib/types";

export function ReportsPage() {
  const { accessToken } = useAuth();
  const [team, setTeam] = useState<TeamReport | null>(null);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [notice, setNotice] = useState("");

  async function load() {
    if (!accessToken) return;
    const [nextTeam, nextFunnel, nextTargets] = await Promise.all([
      api<TeamReport>("/reports/team", { token: accessToken }),
      api<Funnel>("/reports/funnel?days=30", { token: accessToken }),
      api<TargetRow[]>("/targets", { token: accessToken }),
    ]);
    setTeam(nextTeam);
    setFunnel(nextFunnel);
    setAmounts(Object.fromEntries(nextTargets.map((row) => [row.userId, row.amount ? String(row.amount) : ""])));
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, [accessToken]);

  async function saveTarget(event: FormEvent, userId: number) {
    event.preventDefault();
    if (!accessToken) return;
    const amount = Number(amounts[userId] || 0);
    await api("/targets", {
      method: "PUT",
      token: accessToken,
      body: JSON.stringify({ userId, amount }),
    });
    setNotice("Target saved.");
    await load();
  }

  async function exportExcel() {
    if (!accessToken) return;
    const response = await fetch(`${API_BASE}/reports/export`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      setNotice("Could not export.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "salestrack-report.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page wide">
      <h1>Reports</h1>
      <p className="muted">Monthly targets, today’s work, and the lead → visit → sale funnel. No kilometre score.</p>
      <div className="toolbar">
        <button className="btn blue" onClick={exportExcel}>
          Export Excel
        </button>
        {notice ? <span className="muted">{notice}</span> : null}
      </div>

      {funnel ? (
        <div className="grid">
          <article className="card">
            <h2>Funnel · 30 days</h2>
            <p className="stat">{funnel.leads}</p>
            <p className="muted">Leads created</p>
          </article>
          <article className="card">
            <h2>Visited</h2>
            <p className="stat">{funnel.visited}</p>
            <p className="muted">{funnel.leadToVisitPercent}% of leads</p>
          </article>
          <article className="card">
            <h2>Sold</h2>
            <p className="stat">{funnel.sold}</p>
            <p className="muted">{funnel.visitToSalePercent}% of visits · ₹{funnel.salesAmount.toLocaleString("en-IN")}</p>
          </article>
        </div>
      ) : null}

      <h2>Team this month</h2>
      <div className="list">
        {(team?.people ?? []).map((person) => (
          <article key={person.userId} className="card">
            <div className="person">
              <div>
                <strong>{person.name}</strong>
                <div className="muted">
                  Today {person.todayVisits} visits · ₹{person.todaySalesAmount.toLocaleString("en-IN")} · {person.missedStops}{" "}
                  missed · {person.overdueFollowUps} overdue
                </div>
                <div className="barBg">
                  <div className="barFill" style={{ width: `${Math.min(100, person.targetPercent)}%` }} />
                </div>
                <div className="muted">
                  ₹{person.monthSalesAmount.toLocaleString("en-IN")} / ₹
                  {person.monthTarget ? person.monthTarget.toLocaleString("en-IN") : "—"} · {person.targetPercent}%
                </div>
                <div className="muted">
                  <Link to={`/leads?assigneeId=${person.userId}`}>Leads</Link>
                  {" · "}
                  <Link to={`/visits?userId=${person.userId}`}>Visits</Link>
                  {" · "}
                  <Link to="/map">Live map</Link>
                </div>
              </div>
            </div>
            <form className="row-form form" onSubmit={(event) => saveTarget(event, person.userId)}>
              <input
                type="number"
                min="0"
                placeholder="Monthly target ₹"
                value={amounts[person.userId] ?? ""}
                onChange={(event) => setAmounts((current) => ({ ...current, [person.userId]: event.target.value }))}
              />
              <button className="btn green" type="submit">
                Save target
              </button>
            </form>
          </article>
        ))}
        {!team?.people.length ? <p className="muted">No sales executives yet.</p> : null}
      </div>
    </div>
  );
}
