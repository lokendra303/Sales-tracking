import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

type Row = {
  tenantId: number;
  companyName: string;
  status: string;
  createdAt: string;
  manager: { id: number; name: string; phone: string; status: string } | null;
};

export function RegistrationsPage() {
  const { accessToken } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");

  async function load() {
    if (!accessToken) return;
    setRows(await api<Row[]>("/registrations", { token: accessToken }));
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load."));
  }, [accessToken]);

  async function decide(tenantId: number, action: "approve" | "reject") {
    if (!accessToken) return;
    setError("");
    try {
      await api(`/registrations/${tenantId}/decide`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ action }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update.");
    }
  }

  async function setActive(tenantId: number, active: boolean) {
    if (!accessToken) return;
    setError("");
    try {
      await api(`/registrations/${tenantId}/active`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ active }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update.");
    }
  }

  function statusLabel(status: string) {
    if (status === "active") return "Active";
    if (status === "inactive") return "Inactive";
    if (status === "rejected") return "Declined";
    return "Pending";
  }

  return (
    <div className="page wide">
      <p className="kicker">System admin</p>
      <h1>Managers</h1>
      <p className="muted">Managers register themselves. Approve first, then set Active or Inactive. Inactive companies cannot log in.</p>
      {error ? <p className="error">{error}</p> : null}

      <table className="table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Manager</th>
            <th>Phone</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.tenantId}>
              <td>
                <strong>{row.companyName}</strong>
                <div className="muted small">{new Date(row.createdAt).toLocaleString()}</div>
              </td>
              <td>{row.manager?.name ?? "—"}</td>
              <td>{row.manager?.phone ?? "—"}</td>
              <td className={row.status === "active" ? "on" : row.status === "rejected" || row.status === "inactive" ? "off" : "muted"}>
                {statusLabel(row.status)}
              </td>
              <td>
                {row.status === "pending" ? (
                  <div className="seq-btns">
                    <button className="btn green" type="button" onClick={() => decide(row.tenantId, "approve")}>
                      Approve
                    </button>
                    <button className="btn red" type="button" onClick={() => decide(row.tenantId, "reject")}>
                      Decline
                    </button>
                  </div>
                ) : (
                  <div className="seq-btns">
                    {row.status === "active" ? (
                      <button className="btn red" type="button" onClick={() => setActive(row.tenantId, false)}>
                        Set inactive
                      </button>
                    ) : (
                      <button className="btn green" type="button" onClick={() => setActive(row.tenantId, true)}>
                        Set active
                      </button>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length ? <p className="muted">No company requests yet.</p> : null}
    </div>
  );
}
