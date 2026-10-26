import { useEffect, useState, type FormEvent } from "react";
import { PasswordField } from "../components/PasswordField";
import { api, type ApiUser } from "../lib/api";
import { useAuth } from "../lib/auth";
import { mobileDigits } from "../lib/phone";
import { accessLabel, isAdmin, isManager, roleLabel } from "../lib/roles";

export function ProfilePage() {
  const { user, accessToken, refreshUser } = useAuth();
  const admin = isAdmin(user?.roles);
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [designation, setDesignation] = useState(user?.designation ?? "");
  const [city, setCity] = useState(user?.city ?? "");
  const [address, setAddress] = useState(user?.address ?? "");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    setName(user?.name ?? "");
    setPhone(user?.phone ?? "");
    setEmail(user?.email ?? "");
    setDesignation(user?.designation ?? "");
    setCity(user?.city ?? "");
    setAddress(user?.address ?? "");
    setShowMore(Boolean(user?.address));
  }, [user]);

  async function onSaveProfile(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setError("");
    setNotice("");
    setSaving(true);
    try {
      await api<ApiUser>("/auth/me", {
        method: "PATCH",
        token: accessToken,
        body: JSON.stringify({
          name,
          phone,
          email: email || undefined,
          designation: designation || undefined,
          city: city || undefined,
          address: address || null,
        }),
      });
      await refreshUser();
      setNotice("Profile saved. Next login uses these details from the database.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  async function onChangePassword(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }
    if (!accessToken) return;
    setSaving(true);
    try {
      await api("/auth/change-password", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ oldPassword, newPassword, confirmPassword }),
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice("Password updated. Use it on the next login.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <h1>Profile</h1>
      <p className="muted">
        {admin
          ? "Admin sign-in needs email + mobile + password. Forgot password emails the address saved here."
          : "Update your login mobile, email, and password. Forgot password uses this email."}
      </p>

      <article className="card person profile-hero">
        <div className="brand">
          <div className="logo">{user?.name.slice(0, 1)}</div>
          <div>
            <strong>{user?.name}</strong>
            <div className="muted">
              {roleLabel(user?.roles)} · {user?.tenant.name} · {accessLabel(user?.roles)}
            </div>
          </div>
        </div>
      </article>

      <div className="profile-grid">
        <form className="card form wide form-compact" onSubmit={onSaveProfile}>
          <h2>Account details</h2>
          <div className="grid-3">
            <label>
              Full name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              Mobile (login)
              <input
                value={phone}
                onChange={(e) => setPhone(mobileDigits(e.target.value))}
                inputMode="numeric"
                required
              />
            </label>
            <label>
              Email (OTP)
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              Designation
              <input value={designation} onChange={(e) => setDesignation(e.target.value)} />
            </label>
            <label>
              City
              <input value={city} onChange={(e) => setCity(e.target.value)} />
            </label>
          </div>
          <button type="button" className="link more-toggle" onClick={() => setShowMore((value) => !value)}>
            {showMore ? "Hide address" : "Add address"}
          </button>
          {showMore ? (
            <label>
              Address
              <input value={address} onChange={(e) => setAddress(e.target.value)} />
            </label>
          ) : null}
          <div className="actions">
            <button className="btn green" disabled={saving}>
              Save profile
            </button>
          </div>
        </form>

        <form className="card form form-compact" onSubmit={onChangePassword}>
          <h2>Change password</h2>
          <PasswordField value={oldPassword} onChange={setOldPassword} placeholder="Current password" required />
          <PasswordField
            value={newPassword}
            onChange={setNewPassword}
            placeholder="New password"
            required
            autoComplete="new-password"
          />
          <PasswordField
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Confirm new password"
            required
            autoComplete="new-password"
          />
          <div className="actions">
            <button className="btn blue" disabled={saving}>
              Update password
            </button>
          </div>
        </form>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="on">{notice}</p> : null}

      {accessToken && user && isManager(user.roles) && !admin ? (
        <DeskAccess token={accessToken} actorId={user.id} iAmOwner={Boolean(user.isOwner)} />
      ) : null}
    </div>
  );
}

type DeskPerson = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  employeeId: string | null;
  designation: string | null;
  city: string | null;
  loginPassword?: string | null;
  status: string;
  roles: string[];
  isOwner?: boolean;
};

type DeskForm = {
  name: string;
  phone: string;
  email: string;
  employeeId: string;
  designation: string;
  city: string;
  password: string;
  status: "ACTIVE" | "DISABLED";
};

const emptyDesk: DeskForm = {
  name: "",
  phone: "",
  email: "",
  employeeId: "",
  designation: "Desk assistant",
  city: "",
  password: "",
  status: "ACTIVE",
};

function DeskAccess({ token, actorId, iAmOwner }: { token: string; actorId: number; iAmOwner: boolean }) {
  const [people, setPeople] = useState<DeskPerson[]>([]);
  const [form, setForm] = useState<DeskForm>(emptyDesk);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [issued, setIssued] = useState("");
  const [busy, setBusy] = useState(false);
  const deskPeople = people.filter((person) => person.roles.includes("MANAGER"));
  const editing = editingId ? deskPeople.find((person) => person.id === editingId) : null;
  const canToggleStatus = Boolean(editing) && editing!.id !== actorId && !editing!.isOwner && iAmOwner;

  async function load() {
    setPeople(await api<DeskPerson[]>("/users", { token }));
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, [token]);

  function setField<K extends keyof DeskForm>(key: K, value: DeskForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function startEdit(person: DeskPerson) {
    setEditingId(person.id);
    setError("");
    setIssued("");
    setForm({
      name: person.name,
      phone: person.phone,
      email: person.email ?? "",
      employeeId: person.employeeId ?? "",
      designation: person.designation ?? "",
      city: person.city ?? "",
      password: person.loginPassword ?? "",
      status: person.status === "DISABLED" ? "DISABLED" : "ACTIVE",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyDesk);
    setError("");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setIssued("");
    const nextPassword = form.password.trim();
    if ((!editingId && nextPassword.length < 6) || (editingId && nextPassword && nextPassword.length < 6)) {
      setError("Password must be at least 6 characters.");
      return;
    }
    const passwordChanged = nextPassword !== (editing?.loginPassword ?? "").trim();
    setBusy(true);
    try {
      if (editingId) {
        await api(`/users/${editingId}`, {
          method: "PUT",
          token,
          body: JSON.stringify({
            name: form.name,
            phone: form.phone,
            email: form.email,
            employeeId: form.employeeId,
            designation: form.designation,
            city: form.city,
            ...(canToggleStatus ? { status: form.status } : {}),
            ...(passwordChanged && nextPassword ? { password: nextPassword } : {}),
          }),
        });
        setIssued(passwordChanged && nextPassword ? `Desk login updated. Password is now ${nextPassword}.` : "Desk login updated.");
        cancelEdit();
      } else {
        await api("/users", {
          method: "POST",
          token,
          body: JSON.stringify({
            name: form.name,
            phone: form.phone,
            email: form.email,
            password: nextPassword,
            employeeId: form.employeeId,
            designation: form.designation,
            city: form.city,
            role: "MANAGER",
          }),
        });
        setIssued(`Desk login ready: ${form.phone} / ${nextPassword}. They sign in on this portal with their own mobile and password.`);
        setForm(emptyDesk);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save desk access.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form wide form-compact" onSubmit={onSubmit} style={{ marginTop: 16 }}>
      <h2>Desk portal access</h2>
      <p className="muted">
        Add a person who can open this desk with their own mobile number and password. Salespeople stay on the Team page.
      </p>
      <div className="grid-3">
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
          <input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} autoComplete="email" required />
        </label>
        <label>
          Designation *
          <input value={form.designation} onChange={(e) => setField("designation", e.target.value)} required />
        </label>
        <label>
          City *
          <input value={form.city} onChange={(e) => setField("city", e.target.value)} required />
        </label>
        {editingId ? (
          <>
            {canToggleStatus ? (
              <label>
                Status
                <select value={form.status} onChange={(e) => setField("status", e.target.value as DeskForm["status"])}>
                  <option value="ACTIVE">Active</option>
                  <option value="DISABLED">Off</option>
                </select>
              </label>
            ) : (
              <label>
                Status
                <input
                  value={editing?.isOwner ? "Main manager (cannot turn off)" : form.status === "ACTIVE" ? "Active" : "Off"}
                  disabled
                />
              </label>
            )}
            <label>
              Current password
              <PasswordField value={form.password} onChange={(value) => setField("password", value)} autoComplete="off" startVisible />
            </label>
          </>
        ) : (
          <label>
            Desk password *
            <PasswordField value={form.password} onChange={(value) => setField("password", value)} required autoComplete="new-password" />
          </label>
        )}
      </div>
      <div className="actions">
        <button className="btn green" disabled={busy}>
          {busy ? "Saving…" : editingId ? "Save desk login" : "Add desk access"}
        </button>
        {editingId ? (
          <button type="button" className="btn" onClick={cancelEdit}>
            Cancel
          </button>
        ) : null}
      </div>
      {error ? <p className="error">{error}</p> : null}
      {issued ? <p className="on">{issued}</p> : null}
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Mobile</th>
              <th>Password</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {deskPeople.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.name}</strong>
                  <div className="muted">{item.isOwner ? "Main manager" : item.designation || roleLabel(item.roles)}</div>
                </td>
                <td>{item.phone}</td>
                <td>{item.loginPassword || "—"}</td>
                <td className={item.status === "ACTIVE" ? "on" : "off"}>{item.status === "ACTIVE" ? "Active" : "Off"}</td>
                <td>
                  <button type="button" className="link" onClick={() => startEdit(item)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}
