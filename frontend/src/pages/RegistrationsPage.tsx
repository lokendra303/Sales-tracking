import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

type Manager = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  employeeId: string | null;
  designation: string | null;
  city: string | null;
  address: string | null;
  joiningDate: string | null;
  status: string;
  createdAt?: string;
};

type Row = {
  tenantId: number;
  companyName: string;
  slug: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  manager: Manager | null;
  counts?: { users: number; leads: number; visits: number; sales: number };
  settings?: {
    liveLocationEnabled: boolean;
    timezone: string;
    currency: string;
    workStart: string;
    workEnd: string;
  } | null;
};

type Detail = Row & {
  salesPeople?: {
    id: number;
    name: string;
    phone: string;
    email: string | null;
    employeeId: string | null;
    designation: string | null;
    city: string | null;
    status: string;
  }[];
  counts: {
    users: number;
    leads: number;
    visits: number;
    sales: number;
    customers?: number;
  };
};

function isSuspended(status: string) {
  return status === "inactive" || status === "suspended";
}

export function RegistrationsPage() {
  const { accessToken } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!accessToken) return;
    setRows(await api<Row[]>("/registrations", { token: accessToken }));
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load."));
  }, [accessToken]);

  async function openDetail(tenantId: number) {
    if (!accessToken) return;
    setError("");
    try {
      setDetail(await api<Detail>(`/registrations/${tenantId}`, { token: accessToken }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load details.");
    }
  }

  async function decide(tenantId: number, action: "approve" | "reject") {
    if (!accessToken) return;
    setError("");
    setBusy(true);
    try {
      await api(`/registrations/${tenantId}/decide`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ action }),
      });
      await load();
      if (detail?.tenantId === tenantId) await openDetail(tenantId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update.");
    } finally {
      setBusy(false);
    }
  }

  async function setSuspended(tenantId: number, suspended: boolean) {
    if (!accessToken) return;
    const label = suspended ? "Suspend this company? All logins stop immediately." : "Restore this company?";
    if (!window.confirm(label)) return;
    setError("");
    setBusy(true);
    try {
      await api(`/registrations/${tenantId}/suspend`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ suspended }),
      });
      await load();
      if (detail?.tenantId === tenantId) await openDetail(tenantId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update.");
    } finally {
      setBusy(false);
    }
  }

  function statusLabel(status: string) {
    if (status === "active") return "Active";
    if (isSuspended(status)) return "Suspended";
    if (status === "rejected") return "Declined";
    return "Pending";
  }

  return (
    <div className="page wide">
      <p className="kicker">System admin</p>
      <h1>Managers & companies</h1>
      <p className="muted">
        View full manager and company details. Approve new registrations, then suspend or restore anytime.
      </p>
      {error ? <p className="error">{error}</p> : null}

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Manager</th>
              <th>Contact</th>
              <th>Team</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.tenantId}>
                <td>
                  <strong>{row.companyName}</strong>
                  <div className="muted small">{row.slug}</div>
                  <div className="muted small">{new Date(row.createdAt).toLocaleString()}</div>
                </td>
                <td>
                  {row.manager?.name ?? "—"}
                  {row.manager?.designation ? (
                    <div className="muted small">{row.manager.designation}</div>
                  ) : null}
                  {row.manager?.city ? <div className="muted small">{row.manager.city}</div> : null}
                </td>
                <td>
                  <div>{row.manager?.phone ?? "—"}</div>
                  <div className="muted small">{row.manager?.email ?? "No email"}</div>
                </td>
                <td>
                  <div className="muted small">
                    {row.counts?.users ?? "—"} people · {row.counts?.leads ?? 0} leads · {row.counts?.visits ?? 0}{" "}
                    visits
                  </div>
                </td>
                <td
                  className={
                    row.status === "active"
                      ? "on"
                      : row.status === "rejected" || isSuspended(row.status)
                        ? "off"
                        : "muted"
                  }
                >
                  {statusLabel(row.status)}
                </td>
                <td>
                  <div className="seq-btns">
                    <button className="btn" type="button" disabled={busy} onClick={() => openDetail(row.tenantId)}>
                      Details
                    </button>
                    {row.status === "pending" ? (
                      <>
                        <button
                          className="btn green"
                          type="button"
                          disabled={busy}
                          onClick={() => decide(row.tenantId, "approve")}
                        >
                          Approve
                        </button>
                        <button
                          className="btn red"
                          type="button"
                          disabled={busy}
                          onClick={() => decide(row.tenantId, "reject")}
                        >
                          Decline
                        </button>
                      </>
                    ) : null}
                    {row.status === "active" ? (
                      <button
                        className="btn red"
                        type="button"
                        disabled={busy}
                        onClick={() => setSuspended(row.tenantId, true)}
                      >
                        Suspend
                      </button>
                    ) : null}
                    {isSuspended(row.status) || row.status === "rejected" ? (
                      <button
                        className="btn green"
                        type="button"
                        disabled={busy}
                        onClick={() => setSuspended(row.tenantId, false)}
                      >
                        Restore
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length ? <p className="muted">No company requests yet.</p> : null}

      {detail ? (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="seq-btns" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <p className="kicker">Full details</p>
              <h2>{detail.companyName}</h2>
            </div>
            <button className="btn" type="button" onClick={() => setDetail(null)}>
              Close
            </button>
          </div>
          <div className="grid" style={{ gap: 16 }}>
            <div>
              <p className="kicker">Company</p>
              <p>
                <strong>Status:</strong> {statusLabel(detail.status)}
              </p>
              <p>
                <strong>Slug:</strong> {detail.slug}
              </p>
              <p>
                <strong>Registered:</strong> {new Date(detail.createdAt).toLocaleString()}
              </p>
              <p>
                <strong>Counts:</strong> {detail.counts.users} people · {detail.counts.leads} leads ·{" "}
                {detail.counts.visits} visits · {detail.counts.sales} sales
                {detail.counts.customers != null ? ` · ${detail.counts.customers} customers` : ""}
              </p>
              {detail.settings ? (
                <p className="muted small">
                  {detail.settings.timezone} · {detail.settings.currency} · work {detail.settings.workStart}–
                  {detail.settings.workEnd} · live GPS {detail.settings.liveLocationEnabled ? "On" : "Off"}
                </p>
              ) : null}
            </div>
            <div>
              <p className="kicker">Manager</p>
              {detail.manager ? (
                <>
                  <p>
                    <strong>{detail.manager.name}</strong>
                  </p>
                  <p>Mobile: {detail.manager.phone}</p>
                  <p>Email: {detail.manager.email ?? "—"}</p>
                  <p>Employee ID: {detail.manager.employeeId ?? "—"}</p>
                  <p>Designation: {detail.manager.designation ?? "—"}</p>
                  <p>City: {detail.manager.city ?? "—"}</p>
                  <p>Address: {detail.manager.address ?? "—"}</p>
                  <p>
                    Joining:{" "}
                    {detail.manager.joiningDate
                      ? new Date(detail.manager.joiningDate).toLocaleDateString()
                      : "—"}
                  </p>
                  <p>Account: {detail.manager.status}</p>
                </>
              ) : (
                <p className="muted">No manager on this company.</p>
              )}
            </div>
          </div>
          {detail.salesPeople?.length ? (
            <div style={{ marginTop: 16 }}>
              <p className="kicker">Sales people</p>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Emp ID</th>
                      <th>City</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.salesPeople.map((person) => (
                      <tr key={person.id}>
                        <td>{person.name}</td>
                        <td>{person.phone}</td>
                        <td>{person.email ?? "—"}</td>
                        <td>{person.employeeId ?? "—"}</td>
                        <td>{person.city ?? "—"}</td>
                        <td>{person.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          <div className="seq-btns" style={{ marginTop: 16 }}>
            {detail.status === "pending" ? (
              <>
                <button className="btn green" type="button" disabled={busy} onClick={() => decide(detail.tenantId, "approve")}>
                  Approve
                </button>
                <button className="btn red" type="button" disabled={busy} onClick={() => decide(detail.tenantId, "reject")}>
                  Decline
                </button>
              </>
            ) : isSuspended(detail.status) || detail.status === "rejected" ? (
              <button className="btn green" type="button" disabled={busy} onClick={() => setSuspended(detail.tenantId, false)}>
                Restore company
              </button>
            ) : detail.status === "active" ? (
              <button className="btn red" type="button" disabled={busy} onClick={() => setSuspended(detail.tenantId, true)}>
                Suspend company
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
