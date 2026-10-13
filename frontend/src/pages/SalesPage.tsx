import { useEffect, useState } from "react";
import { ExecFilter, useExecutives, type ExecValue } from "../components/ExecFilter";
import { api, apiBlob } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Sale } from "../lib/types";

export function SalesPage() {
  const { accessToken } = useAuth();
  const people = useExecutives();
  const [sales, setSales] = useState<Sale[]>([]);
  const [exec, setExec] = useState<ExecValue>("all");
  const [bills, setBills] = useState<Record<number, string | "loading" | "failed">>({});
  const [openBill, setOpenBill] = useState<number | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    const qs = typeof exec === "number" ? `&userId=${exec}` : "";
    api<Sale[]>(`/sales?days=30${qs}`, { token: accessToken }).then(setSales).catch(() => undefined);
  }, [accessToken, exec]);

  async function toggleBill(saleId: number) {
    if (openBill === saleId) {
      setOpenBill(null);
      return;
    }
    setOpenBill(saleId);
    if (!accessToken || (bills[saleId] && bills[saleId] !== "failed")) return;
    setBills((prev) => ({ ...prev, [saleId]: "loading" }));
    try {
      const url = await apiBlob(`/sales/${saleId}/bill`, accessToken);
      setBills((prev) => ({ ...prev, [saleId]: url }));
    } catch {
      setBills((prev) => ({ ...prev, [saleId]: "failed" }));
    }
  }

  const total = sales.reduce((sum, row) => (sum + (row.amount ?? 0)), 0);

  return (
    <div className="page">
      <h1>Sales</h1>
      <p className="muted">Recorded as amount + note. Pick an executive to see only their sales.</p>
      <ExecFilter people={people} value={exec} onChange={setExec} />
      <p className="stat">₹{total.toLocaleString("en-IN")}</p>
      <div className="list">
        {sales.map((sale) => {
          const bill = bills[sale.id];
          return (
            <article key={sale.id} className="card">
              <div className="person">
                <div>
                  <strong>{sale.name}</strong>
                  <div className="muted">
                    {sale.userName} · {new Date(sale.createdAt).toLocaleString()}
                    {sale.note ? ` · ${sale.note}` : ""}
                  </div>
                  {sale.hasBillPhoto ? (
                    <button className="link" onClick={() => toggleBill(sale.id)}>
                      {openBill === sale.id ? "Hide bill" : "View bill"}
                    </button>
                  ) : null}
                </div>
                <strong>₹{sale.amount}</strong>
              </div>
              {openBill === sale.id ? (
                bill === "loading" || !bill ? (
                  <p className="muted">Loading bill…</p>
                ) : bill === "failed" ? (
                  <p className="error">Could not load the bill photo.</p>
                ) : (
                  <img className="proof" src={bill} alt={`Bill for ${sale.name}`} />
                )
              ) : null}
            </article>
          );
        })}
        {!sales.length ? <p className="muted">No sales in the last 30 days for this view.</p> : null}
      </div>
    </div>
  );
}
