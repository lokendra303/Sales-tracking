import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { isAdmin, isManager, isPlatformAdmin } from "../lib/roles";
import type { HomeData } from "../lib/types";

export function HomePage() {
  const { user, accessToken } = useAuth();
  const admin = isAdmin(user?.roles);
  const manager = isManager(user?.roles);
  const platform = isPlatformAdmin(user);
  const [home, setHome] = useState<HomeData | null>(null);
  const [people, setPeople] = useState(0);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (!accessToken) return;
    api<HomeData>("/home", { token: accessToken }).then(setHome).catch(() => undefined);
    api<{ id: number }[]>("/users", { token: accessToken })
      .then((rows) => setPeople(rows.length))
      .catch(() => undefined);
    if (platform) {
      api<{ status: string }[]>("/registrations", { token: accessToken })
        .then((rows) => setPending(rows.filter((row) => row.status === "pending").length))
        .catch(() => undefined);
    }
  }, [accessToken, platform]);

  return (
    <div className="page">
      <p className="kicker">Good day</p>
      <h1>{user?.name.split(" ")[0]}</h1>
      <p className="muted">
        {admin
          ? "System admin desk — managers register themselves. You only approve the company."
          : "Desk for the sales team. Plan the beat and review proof here. Field work stays on the phone."}
      </p>

      <div className="grid">
        {manager ? (
          <article className="card kpi">
            <p className="kicker">Team</p>
            <p className="stat">{people}</p>
            <Link to="/team">Open roster</Link>
          </article>
        ) : null}
        {manager ? (
          <article className="card kpi">
            <p className="kicker">Lead approval</p>
            <p className="stat">{home?.pendingApprovals ?? 0}</p>
            <p className="muted">New leads from the field, waiting for you</p>
            <Link to="/leads?approval=pending">Review leads</Link>
          </article>
        ) : null}
        {manager ? (
          <>
            <article className="card kpi">
              <p className="kicker">Today</p>
              <h2>Work so far</h2>
              <p>
                {home?.todayLeads ?? 0} new leads · {home?.todayVisits ?? 0} visits · ₹
                {(home?.todaySalesAmount ?? 0).toLocaleString("en-IN")}
              </p>
              <p className="muted">
                Month ₹{(home?.monthSalesAmount ?? 0).toLocaleString("en-IN")} / ₹
                {home?.monthTarget ? home.monthTarget.toLocaleString("en-IN") : "—"} · {home?.targetPercent ?? 0}%
              </p>
              <Link to="/beat">Plan beat</Link>
              {" · "}
              <Link to="/leads">Open leads</Link>
              {" · "}
              <Link to="/reports">Reports</Link>
            </article>
            <article className="card kpi">
              <p className="kicker">Proof</p>
              <h2>Visits & map</h2>
              <p className="muted">Review place photos, then confirm. Live map only if admin turned GPS On.</p>
              <Link to="/visits">Visit proof</Link>
              {" · "}
              <Link to="/map">Live map</Link>
            </article>
          </>
        ) : null}
        {platform ? (
          <article className="card kpi">
            <p className="kicker">Approvals</p>
            <p className="stat">{pending}</p>
            <p className="muted">Companies waiting</p>
            <Link to="/registrations">Approve managers</Link>
          </article>
        ) : null}
        {admin ? (
          <article className="card kpi">
            <p className="kicker">Privacy</p>
            <h2>Live location</h2>
            <p>{user?.liveLocationEnabled ? "On — GPS streams after Start Field Work" : "Off — visit photos still prove the stop"}</p>
            <Link to="/settings">Open settings</Link>
          </article>
        ) : null}
      </div>

      {manager && (home?.overdueItems?.length || home?.overdueFollowUps) ? (
        <article className="card alert">
          <h2>Overdue follow-ups</h2>
          <p className="muted">{home.overdueFollowUps} need a call or visit.</p>
          <div className="list">
            {(home.overdueItems ?? []).map((item) => (
              <div key={item.id} className="person">
                <div>
                  <strong>{item.name}</strong>
                  <div className="muted">{item.type} · due {new Date(item.dueAt).toLocaleString()}</div>
                </div>
                <Link to="/leads">Open leads</Link>
              </div>
            ))}
          </div>
        </article>
      ) : null}
    </div>
  );
}
