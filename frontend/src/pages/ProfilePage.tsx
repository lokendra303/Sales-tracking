import { useEffect, useState, type FormEvent } from "react";
import { PasswordField } from "../components/PasswordField";
import { api, type ApiUser } from "../lib/api";
import { useAuth } from "../lib/auth";
import { mobileDigits } from "../lib/phone";
import { accessLabel, isAdmin, roleLabel } from "../lib/roles";

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

  useEffect(() => {
    setName(user?.name ?? "");
    setPhone(user?.phone ?? "");
    setEmail(user?.email ?? "");
    setDesignation(user?.designation ?? "");
    setCity(user?.city ?? "");
    setAddress(user?.address ?? "");
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
      setNotice("Profile saved. The next login uses this mobile number from the database — not the .env seed values.");
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
      setNotice("Password updated in the database. Use it on the next login.");
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
        First-time seed from backend .env: <code>ADMIN_PHONE</code>, <code>ADMIN_PASSWORD</code>, and{" "}
        <code>ADMIN_EMAIL</code>. Admin login needs email + mobile + password (more secure than managers). After the
        first seed, change them here anytime. Forgot password sends an OTP to the email on this profile.
      </p>

      <article className="card person">
        <div className="brand">
          <div className="logo">{user?.name.slice(0, 1)}</div>
          <div>
            <strong>{user?.name}</strong>
            <div className="muted">{roleLabel(user?.roles)}</div>
          </div>
        </div>
      </article>

      <form className="card form" onSubmit={onSaveProfile}>
        <h2>Account details</h2>
        <div className="grid-2">
          <label>
            Full name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Mobile (login)
            <input value={phone} onChange={(e) => setPhone(mobileDigits(e.target.value))} inputMode="numeric" required />
          </label>
          <label>
            Email (password reset OTP)
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
        <label>
          Address
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
        </label>
        <p className="muted">Company: {user?.tenant.name}</p>
        <p className="muted">
          {admin
            ? "System admin. Managers register themselves. You approve the company, not the sales team."
            : "You manage sales executives. Field visits stay on their phones."}
        </p>
        <p className="muted">Access: {accessLabel(user?.roles)}</p>
        <button className="btn green" disabled={saving}>
          Save profile
        </button>
      </form>

      <form className="card form" onSubmit={onChangePassword}>
        <h2>Change password</h2>
        <PasswordField value={oldPassword} onChange={setOldPassword} placeholder="Current password" required />
        <PasswordField value={newPassword} onChange={setNewPassword} placeholder="New password" required autoComplete="new-password" />
        <PasswordField value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirm new password" required autoComplete="new-password" />
        <button className="btn blue" disabled={saving}>
          Update password
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="on">{notice}</p> : null}
    </div>
  );
}
