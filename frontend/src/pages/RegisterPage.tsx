import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { PasswordField } from "../components/PasswordField";
import { mobileDigits } from "../lib/phone";

export function RegisterPage() {
  const [companyName, setCompanyName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    setError("");
    setCodeSent("");
    setSending(true);
    try {
      const data = await api<{ message: string }>("/auth/register/otp", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setCodeSent(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code.");
    } finally {
      setSending(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api<{ message: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ companyName, name, email: email.trim(), phone, password, otp }),
      });
      setDone(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register.");
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
            New company
          </p>
          <h1>Register your desk</h1>
          <p>Create a company as the manager. We email a 6-digit code to confirm the address. The system admin approves it. Then you add salespeople and give them phone logins.</p>
        </div>
        <p className="small">One backend. This portal for the desk. The app for the field.</p>
      </section>
      <section className="login-panel">
        <form className="card form" onSubmit={onSubmit}>
          {done ? (
            <>
              <p className="kicker">Waiting</p>
              <h2>Sent for approval</h2>
              <p>{done}</p>
              <Link className="btn blue" to="/login" style={{ textAlign: "center" }}>
                Back to sign in
              </Link>
            </>
          ) : (
            <>
              <p className="kicker">Apply</p>
              <h2>Company + manager</h2>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company name" required />
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (manager)" required />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Work email" type="email" required autoComplete="email" />
              <button className="btn blue" type="button" disabled={sending || !email.trim()} onClick={() => void sendCode()}>
                {sending ? "Sending code…" : "Send email code"}
              </button>
              {codeSent ? <p className="muted small">{codeSent}</p> : null}
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit email code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
              />
              <input
                value={phone}
                onChange={(e) => setPhone(mobileDigits(e.target.value))}
                placeholder="10-digit mobile number"
                inputMode="numeric"
                autoComplete="tel"
                required
              />
              <PasswordField value={password} onChange={setPassword} required autoComplete="new-password" />
              {error ? <p className="error">{error}</p> : null}
              <button className="btn blue" disabled={loading || otp.length !== 6}>
                {loading ? "Sending…" : "Request access"}
              </button>
              <p className="muted small">
                Already approved? <Link to="/login">Sign in</Link>
              </p>
            </>
          )}
        </form>
      </section>
    </div>
  );
}
