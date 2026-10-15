import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { PasswordField } from "../components/PasswordField";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { roleLabel } from "../lib/roles";
import { mobileDigits } from "../lib/phone";

type Person = {
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
  roles: string[];
};

type FormState = {
  name: string;
  phone: string;
  email: string;
  password: string;
  employeeId: string;
  designation: string;
  city: string;
  address: string;
  joiningDate: string;
  status: "ACTIVE" | "DISABLED";
};

const emptyForm: FormState = {
  name: "",
  phone: "",
  email: "",
  password: "",
  employeeId: "",
  designation: "",
  city: "",
  address: "",
  joiningDate: "",
  status: "ACTIVE",
};

function dayValue(iso: string | null) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function TeamPage() {
  const { accessToken } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [issued, setIssued] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!accessToken) return;
    setPeople(await api<Person[]>("/users", { token: accessToken }));
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, [accessToken]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function startEdit(person: Person) {
    setEditingId(person.id);
    setIssued("");
    setError("");
    setForm({
      name: person.name,
      phone: person.phone,
      email: person.email ?? "",
      password: "",
      employeeId: person.employeeId ?? "",
      designation: person.designation ?? "",
      city: person.city ?? "",
      address: person.address ?? "",
      joiningDate: dayValue(person.joiningDate),
      status: person.status === "DISABLED" ? "DISABLED" : "ACTIVE",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setError("");
    setIssued("");
    setBusy(true);
    try {
      if (editingId) {
        await api(`/users/${editingId}`, {
          method: "PUT",
          token: accessToken,
          body: JSON.stringify({
            name: form.name,
            phone: form.phone,
            email: form.email,
            employeeId: form.employeeId,
            designation: form.designation,
            city: form.city,
            address: form.address || null,
            joiningDate: form.joiningDate || null,
            status: form.status,
          }),
        });
        setIssued("Salesperson details updated.");
        cancelEdit();
      } else {
        await api("/users", {
          method: "POST",
          token: accessToken,
          body: JSON.stringify({
            name: form.name,
            phone: form.phone,
            email: form.email,
            password: form.password,
            employeeId: form.employeeId,
            designation: form.designation,
            city: form.city,
            address: form.address || undefined,
            joiningDate: form.joiningDate || undefined,
          }),
        });
        setIssued(`Give this salesperson ${form.phone} / ${form.password}. They log in only on the SalesTrack phone app.`);
        setForm(emptyForm);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <p className="kicker">Sales team</p>
      <h1>Team</h1>
      <p className="muted">
        Add every sales executive with employee details. You can edit phone and profile later. Open an executive to
        review only that person’s leads and visits.
      </p>

      <form className="card form" onSubmit={onSubmit}>
        <h2>{editingId ? "Edit salesperson" : "Add salesperson"}</h2>
        <div className="grid-2">
          <label>
            Full name *
            <input value={form.name} onChange={(e) => setField("name", e.target.value)} required />
          </label>
          <label>
            Employee ID *
            <input value={form.employeeId} onChange={(e) => setField("employeeId", e.target.value)} required />
          </label>
          <label>
            Mobile *
            <input
              value={form.phone}
              onChange={(e) => setField("phone", mobileDigits(e.target.value))}
              inputMode="numeric"
              autoComplete="tel"
              required
            />
          </label>
          <label>
            Email *
            <input
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label>
            Designation *
            <input value={form.designation} onChange={(e) => setField("designation", e.target.value)} required />
          </label>
          <label>
            City *
            <input value={form.city} onChange={(e) => setField("city", e.target.value)} required />
          </label>
          <label>
            Joining date
            <input type="date" value={form.joiningDate} onChange={(e) => setField("joiningDate", e.target.value)} />
          </label>
          {editingId ? (
            <label>
              Status
              <select value={form.status} onChange={(e) => setField("status", e.target.value as FormState["status"])}>
                <option value="ACTIVE">Active</option>
                <option value="DISABLED">Off</option>
              </select>
            </label>
          ) : (
            <label>
              App password *
              <PasswordField value={form.password} onChange={(value) => setField("password", value)} required autoComplete="new-password" />
            </label>
          )}
        </div>
        <label>
          Address
          <textarea value={form.address} onChange={(e) => setField("address", e.target.value)} rows={2} />
        </label>
        <div className="row-form">
          <button className="btn green" disabled={busy}>
            {busy ? "Saving…" : editingId ? "Save changes" : "Add salesperson"}
          </button>
          {editingId ? (
            <button type="button" className="btn" onClick={cancelEdit}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {issued ? <p className="on">{issued}</p> : null}

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Employee ID</th>
              <th>Phone</th>
              <th>City</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {people.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.name}</strong>
                  <div className="muted">{item.designation || roleLabel(item.roles)}</div>
                </td>
                <td>{item.employeeId || "—"}</td>
                <td>{item.phone}</td>
                <td>{item.city || "—"}</td>
                <td className={item.status === "ACTIVE" ? "on" : "off"}>{item.status === "ACTIVE" ? "Active" : "Off"}</td>
                <td>
                  <button type="button" className="link" onClick={() => startEdit(item)}>
                    Edit
                  </button>
                  {" · "}
                  <Link to={`/leads?assigneeId=${item.id}`}>Leads</Link>
                  {" · "}
                  <Link to={`/visits?userId=${item.id}`}>Visits</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
