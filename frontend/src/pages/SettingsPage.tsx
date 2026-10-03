import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

type Settings = {
  liveLocationEnabled: boolean;
  visitCheckinRadiusMeters: number;
  trackingIntervalSeconds: number;
  currency: string;
  timezone: string;
};

export function SettingsPage() {
  const { accessToken, user, refreshUser } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    api<Settings>("/settings", { token: accessToken }).then(setSettings);
  }, [accessToken]);

  async function toggle(enabled: boolean) {
    if (!accessToken || !settings) return;
    setSaving(true);
    try {
      await api("/settings/live-location", {
        method: "PATCH",
        token: accessToken,
        body: JSON.stringify({ enabled }),
      });
      setSettings({ ...settings, liveLocationEnabled: enabled });
      await refreshUser();
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <p className="muted">Loading settings…</p>;

  return (
    <div className="page">
      <h1>Settings</h1>
      <p className="muted">{user?.tenant.name}</p>
      <article className="card">
        <div className="person">
          <div>
            <strong>Live location</strong>
            <p className="muted">Off by default. When on, GPS streams only after a salesperson starts field work. You do not manage the field team.</p>
          </div>
          <button className={settings.liveLocationEnabled ? "btn red" : "btn green"} disabled={saving} onClick={() => toggle(!settings.liveLocationEnabled)}>
            {settings.liveLocationEnabled ? "Turn off" : "Turn on"}
          </button>
        </div>
      </article>
      <article className="card">
        <p>Visit check-in radius: {settings.visitCheckinRadiusMeters} m</p>
        <p>Tracking interval: {Math.round(settings.trackingIntervalSeconds / 60)} min</p>
        <p>Currency: {settings.currency}</p>
        <p>Timezone: {settings.timezone}</p>
      </article>
    </div>
  );
}
