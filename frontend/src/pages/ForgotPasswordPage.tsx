import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PasswordField } from "../components/PasswordField";
import { api } from "../lib/api";
import { mobileDigits } from "../lib/phone";

const RESEND_SEC = 15;

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
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const tick = window.setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(tick);
  }, [resendIn]);

  async function sendCode() {
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
      setResendIn(RESEND_SEC);
      setOtp("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  }

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    await sendCode();
  }

  async function resendCode() {
    if (resendIn > 0 || busy) return;
    await sendCode();
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
          <h2>{step === "request" ? "Find your account" : "Set a new password"}</h2>
          {step === "request" ? (
            <p className="muted small">
              Enter the mobile you use to sign in (admin default is from setup). We email a 6-digit code to the address
              saved on that account — not by SMS. After reset, system admin must tick System admin and sign in with
              email + mobile + new password.
            </p>
          ) : (
            <p className="muted small">
              Check your email inbox (and spam). Use only the newest code if you requested more than once.
            </p>
          )}
          <input
            value={phone}
            onChange={(e) => setPhone(mobileDigits(e.target.value))}
            placeholder="Your login mobile number"
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
                placeholder="6-digit code from email"
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
            {busy ? "Please wait…" : step === "request" ? "Email me a code" : "Save new password"}
          </button>
          {step === "reset" ? (
            <>
              <button type="button" className="link" disabled={busy || resendIn > 0} onClick={resendCode}>
                {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
              </button>
              <button
                type="button"
                className="link"
                onClick={() => {
                  setStep("request");
                  setResendIn(0);
                  setOtp("");
                  setNotice("");
                  setError("");
                }}
              >
                Use a different mobile
              </button>
            </>
          ) : null}
          <p className="muted small">
            Remembered it? <Link to="/login">Back to sign in</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
