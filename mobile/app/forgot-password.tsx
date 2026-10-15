import { useEffect, useState } from "react";
import { router } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { Button, Field, PasswordField, Screen, ScreenHeader } from "@/components/ui";
import { api, isOfflineError } from "@/lib/api";
import { colors, typo } from "@/lib/theme";

const RESEND_SEC = 15;

export default function ForgotPasswordScreen() {
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
    const tick = setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => clearTimeout(tick);
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
      setError(
        isOfflineError(err)
          ? "Cannot reach the server."
          : err instanceof Error
            ? err.message
            : "Could not send the code.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
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
      setTimeout(() => router.replace("/login"), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen keyboard header={<ScreenHeader title="Forgot password" back align="center" fallback="/login" />}>
      <Text style={typo.muted}>
        Managers and admins only. Enter the mobile you use to sign in. The 6-digit code is emailed to the address
        saved on that account — not sent by SMS.
      </Text>
      <Field
        label="Login mobile number"
        value={phone}
        onChangeText={setPhone}
        keyboardType="number-pad"
        digitsOnly
        editable={step === "request"}
        placeholder="10-digit mobile"
      />
      {step === "reset" ? (
        <>
          <Text style={typo.muted}>Check your email inbox (and spam) for the code. You can resend after 15 seconds.</Text>
          <Field label="Code from email" value={otp} onChangeText={setOtp} keyboardType="number-pad" digitsOnly placeholder="6 digits" />
          <PasswordField label="New password" value={newPassword} onChangeText={setNewPassword} />
          <PasswordField label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} />
        </>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.ok}>{notice}</Text> : null}
      <Button
        title={step === "request" ? "Email me a code" : "Save new password"}
        tone="green"
        onPress={step === "request" ? sendCode : resetPassword}
        loading={busy}
      />
      {step === "reset" ? (
        <>
          <Button
            title={resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
            tone="outline"
            onPress={sendCode}
            disabled={busy || resendIn > 0}
          />
          <Button
            title="Use a different mobile"
            tone="ghost"
            onPress={() => {
              setStep("request");
              setResendIn(0);
              setOtp("");
              setNotice("");
              setError("");
            }}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.red, fontWeight: "700", textAlign: "center" },
  ok: { color: colors.green, fontWeight: "700", textAlign: "center" },
});
