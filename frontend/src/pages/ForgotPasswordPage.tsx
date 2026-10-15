import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PasswordField } from "../components/PasswordField";
import { api } from "../lib/api";
import { mobileDigits } from "../lib/phone";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const data = await api<{ message: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      setNotice(data.message);
      setStep("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }
    setBusy(true);
    try {
      const data = await api<{ message: string }>("/auth/forgot-password/reset", {
        method: "POST",
        body: JSON.stringify({ phone, otp, newPassword, confirmPassword }),
      });
      setNotice(data.message);
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the password.");
    } finally {
      setBusy(false);
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
          <h1>Reset password</h1>
          <p>We email a 6-digit code to the address already saved on your account.</p>
        </div>
      </section>
      <section className="login-panel">
        <form className="card form" onSubmit={step === "request" ? requestCode : resetPassword}>
          <p className="kicker">Forgot password</p>
          <h2>{step === "request" ? "Send email code" : "Set a new password"}</h2>
          <input
            value={phone}
            onChange={(e) => setPhone(mobileDigits(e.target.value))}
            placeholder="10-digit mobile number"
            inputMode="numeric"
            autoComplete="tel"
            required
            disabled={step === "reset"}
          />
          {step === "reset" ? (
            <>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit email code"
                inputMode="numeric"
                required
              />
              <PasswordField value={newPassword} onChange={setNewPassword} required autoComplete="new-password" />
              <PasswordField value={confirmPassword} onChange={setConfirmPassword} required autoComplete="new-password" />
            </>
          ) : null}
          {error ? <p className="error">{error}</p> : null}
          {notice ? <p className="on">{notice}</p> : null}
          <button className="btn blue" disabled={busy}>
            {busy ? "Please wait…" : step === "request" ? "Send code" : "Save new password"}
          </button>
          {step === "reset" ? (
            <button type="button" className="link" onClick={() => setStep("request")}>
              Use a different mobile
            </button>
          ) : null}
          <p className="muted small">
            Remembered it? <Link to="/login">Back to sign in</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
