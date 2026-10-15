import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PasswordField } from "../components/PasswordField";
import { useAuth } from "../lib/auth";
import { mobileDigits } from "../lib/phone";

export function LoginPage({ blocked = false }: { blocked?: boolean }) {
  const { login, logout, user } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminMode, setAdminMode] = useState(false);
  const [error, setError] = useState(blocked ? "Sales executives use the SalesTrack mobile app." : "");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(phone.trim(), password, adminMode ? email.trim() : undefined);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login">
      <section className="login-brand">
        <div>
          <div className="login-mark">ST</div>
          <p className="kicker" style={{ marginTop: 28 }}>
            Manager & admin
          </p>
          <h1>SalesTrack Desk</h1>
          <p>See the team, confirm visit photos, and plan tomorrow’s beat. The phone is for field work only.</p>
        </div>
        <p className="small">One backend on your server. This portal and the app both talk to it.</p>
      </section>
      <section className="login-panel">
        <form className="card form" onSubmit={onSubmit}>
          {blocked ? (
            <>
              <p className="kicker">Phone only</p>
              <h2>This desk is not for sales executives</h2>
              <p>Field work stays on the SalesTrack app. Same login, different job.</p>
              <button
                type="button"
                className="btn red"
                onClick={async () => {
                  await logout();
                  navigate("/login");
                }}
              >
                Sign out {user?.name}
              </button>
            </>
          ) : (
            <>
              <p className="kicker">Sign in</p>
              <h2>Open the desk</h2>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={adminMode}
                  onChange={(e) => setAdminMode(e.target.checked)}
                />
                <span>System admin (email + mobile + password)</span>
              </label>
              {adminMode ? (
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Admin email"
                  autoComplete="email"
                  required
                />
              ) : null}
              <input
                value={phone}
                onChange={(e) => setPhone(mobileDigits(e.target.value))}
                placeholder="10-digit mobile number"
                inputMode="numeric"
                autoComplete="tel"
              />
              <PasswordField value={password} onChange={setPassword} />
              {adminMode ? (
                <p className="muted small">Admin sign-in needs all three. Managers use mobile + password only.</p>
              ) : null}
              {error ? <p className="error">{error}</p> : null}
              <button className="btn blue" disabled={loading}>
                {loading ? "Signing in…" : "Enter desk"}
              </button>
              <p className="muted small">
                <Link to="/forgot-password">Forgot password?</Link>
              </p>
              <p className="muted small">
                New company? <Link to="/register">Register as manager</Link>
              </p>
            </>
          )}
        </form>
      </section>
    </div>
  );
}
