import { useEffect, useState } from "react";
import { ExecFilter, useExecutives, type ExecValue } from "../components/ExecFilter";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Sale } from "../lib/types";

export function SalesPage() {
  const { accessToken } = useAuth();
  const people = useExecutives();
  const [sales, setSales] = useState<Sale[]>([]);
  const [exec, setExec] = useState<ExecValue>("all");

  useEffect(() => {
    if (!accessToken) return;
    const qs = typeof exec === "number" ? `&userId=${exec}` : "";
    api<Sale[]>(`/sales?days=30${qs}`, { token: accessToken }).then(setSales).catch(() => undefined);
  }, [accessToken, exec]);

  const total = sales.reduce((sum, row) => (sum + (row.amount ?? 0)), 0);

  return (
    <div className="page">
      <h1>Sales</h1>
      <p className="muted">Recorded as amount + note. Pick an executive to see only their sales.</p>
      <ExecFilter people={people} value={exec} onChange={setExec} />
      <p className="stat">₹{total.toLocaleString("en-IN")}</p>
      <div className="list">
        {sales.map((sale) => (
          <article key={sale.id} className="card person">
            <div>
              <strong>{sale.name}</strong>
              <div className="muted">
                {sale.userName} · {new Date(sale.createdAt).toLocaleString()}
                {sale.note ? ` · ${sale.note}` : ""}
                {sale.hasBillPhoto ? " · Bill photo" : ""}
              </div>
            </div>
            <strong>₹{sale.amount}</strong>
          </article>
        ))}
        {!sales.length ? <p className="muted">No sales in the last 30 days for this view.</p> : null}
      </div>
    </div>
  );
}
