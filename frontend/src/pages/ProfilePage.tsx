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
    </div>
  );
}
