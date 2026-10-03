import { useState, type FormEvent } from "react";
import { PasswordField } from "../components/PasswordField";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { accessLabel, isAdmin, isManager, roleLabel } from "../lib/roles";

export function ProfilePage() {
  const { user, accessToken } = useAuth();
  const admin = isAdmin(user?.roles);
  const manager = isManager(user?.roles);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

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
      setNotice("Password updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <h1>Profile</h1>
      <p className="muted">Same login on the web portal and the mobile app.</p>

      <article className="card person">
        <div className="brand">
          <div className="logo">{user?.name.slice(0, 1)}</div>
          <div>
            <strong>{user?.name}</strong>
            <div className="muted">{roleLabel(user?.roles)}</div>
          </div>
        </div>
      </article>

      <article className="card">
        <h2>Account</h2>
        <p>Phone: {user?.phone}</p>
        <p>Company: {user?.tenant.name}</p>
        <p>Role: {roleLabel(user?.roles)}</p>
        <p>
          {admin
            ? "System admin. Managers register themselves. You approve the company, not the sales team."
            : "You manage sales executives. Field visits stay on their phones."}
        </p>
      </article>

      <article className="card">
        <h2>Access</h2>
        <p className="on">{accessLabel(user?.roles)}</p>
        <ul className="access">
          <li>
            <strong>Web portal</strong>
            <span>Desk work — {admin ? "managers and company settings" : "team, leads, follow-ups"}</span>
          </li>
          <li>
            <strong>Mobile app</strong>
            <span>Same account on the phone — {admin ? "settings and managers" : "team and leads on the go"}</span>
          </li>
        </ul>
        {manager ? <p className="muted">Sales executives have mobile only. They cannot open this portal.</p> : null}
      </article>

      {admin || manager ? (
        <article className="card">
          <p className="kicker">Security</p>
          <h2>Change password</h2>
          <p className="muted">Enter your current password, then the new one twice. Salespeople cannot change theirs — you give them a login.</p>
          <form className="form" onSubmit={onChangePassword} style={{ width: "100%", marginTop: 12 }}>
            <PasswordField value={oldPassword} onChange={setOldPassword} placeholder="Current password" required autoComplete="current-password" />
            <PasswordField value={newPassword} onChange={setNewPassword} placeholder="New password" required autoComplete="new-password" />
            <PasswordField value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirm new password" required autoComplete="new-password" />
            {error ? <p className="error">{error}</p> : null}
            {notice ? <p className="on">{notice}</p> : null}
            <button className="btn blue" disabled={saving}>
              {saving ? "Saving…" : "Update password"}
            </button>
          </form>
        </article>
      ) : null}
    </div>
  );
}
