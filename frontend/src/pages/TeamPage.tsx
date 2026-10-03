import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { PasswordField } from "../components/PasswordField";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { roleLabel } from "../lib/roles";

type Person = { id: number; name: string; phone: string; status: string; roles: string[] };

export function TeamPage() {
  const { accessToken } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("Admin@123");
  const [error, setError] = useState("");
  const [issued, setIssued] = useState("");

  async function load() {
    if (!accessToken) return;
    setPeople(await api<Person[]>("/users", { token: accessToken }));
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, [accessToken]);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setError("");
    try {
      await api("/users", { method: "POST", token: accessToken, body: JSON.stringify({ name, phone, password }) });
      setIssued(`Give this salesperson ${phone} / ${password}. They log in only on the SalesTrack phone app.`);
      setName("");
      setPhone("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add.");
    }
  }

  return (
    <div className="page">
      <p className="kicker">Sales team</p>
      <h1>Team</h1>
      <p className="muted">
        Add every sales executive here. Assign leads on Pipeline. Open an executive to review only that person’s
        leads, visits and live map — All executives stays the default.
      </p>

      <form className="card form row-form" onSubmit={add}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" required />
        <PasswordField value={password} onChange={setPassword} required autoComplete="new-password" />
        <button className="btn green">Add salesperson</button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {issued ? <p className="on">{issued}</p> : null}

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Phone</th>
            <th>Status</th>
            <th>Activity</th>
          </tr>
        </thead>
        <tbody>
          {people.map((item) => (
            <tr key={item.id}>
              <td><strong>{item.name}</strong></td>
              <td>{roleLabel(item.roles)}</td>
              <td>{item.phone}</td>
              <td className={item.status === "ACTIVE" ? "on" : "off"}>{item.status === "ACTIVE" ? "Active" : "Off"}</td>
              <td>
                <Link to={`/leads?assigneeId=${item.id}`}>Leads</Link>
                {" · "}
                <Link to={`/visits?userId=${item.id}`}>Visits</Link>
                {" · "}
                <Link to="/map">Live map</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
