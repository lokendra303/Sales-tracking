import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MapView } from "../components/MapView";
import { useExecutives } from "../components/ExecFilter";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

type Lead = {
  id: number;
  name: string;
  phone: string;
  contactPerson: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  assigneeId: number | null;
  assigneeName: string | null;
};

function mapsUrl(lead: Lead) {
  if (lead.latitude != null && lead.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lead.latitude},${lead.longitude}`;
  }
  const q = [lead.address, lead.city].filter(Boolean).join(", ");
  return q ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}` : null;
}

export function LeadDetailPage() {
  const { id } = useParams();
  const { accessToken } = useAuth();
  const people = useExecutives();
  const [lead, setLead] = useState<Lead | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    if (!accessToken || !id) return;
    setLead(await api<Lead>(`/leads/${id}`, { token: accessToken }));
  }

  useEffect(() => {
    load().catch(() => setError("Could not load this lead."));
  }, [accessToken, id]);

  async function assign(userId: number) {
    if (!accessToken || !lead) return;
    setError("");
    try {
      await api(`/leads/${lead.id}/assign`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ userId }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign.");
    }
  }

  async function savePin(lat: number, lng: number) {
    if (!accessToken || !lead) return;
    setNotice("");
    try {
      setLead(
        await api<Lead>(`/leads/${lead.id}`, {
          method: "PUT",
          token: accessToken,
          body: JSON.stringify({ latitude: lat, longitude: lng }),
        }),
      );
      setNotice("Shop pin saved. The executive can follow this map.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the pin.");
    }
  }

  if (!lead) {
    return (
      <div className="page">
        <Link to="/leads">Back to leads</Link>
        <p className="muted">{error || "Loading…"}</p>
      </div>
    );
  }

  const route = mapsUrl(lead);
  const pins =
    lead.latitude != null && lead.longitude != null
      ? [{ lat: lead.latitude, lng: lead.longitude, label: lead.name, extra: [lead.address, lead.city].filter(Boolean).join(", ") }]
      : [];

  return (
    <div className="page">
      <p className="kicker">
        <Link to="/leads">Pipeline</Link>
      </p>
      <h1>{lead.name}</h1>
      <p className="muted">
        {lead.phone}
        {lead.contactPerson ? ` · ${lead.contactPerson}` : ""} · {lead.assigneeName || "Unassigned"} · {lead.status}
      </p>
      <p className="muted">{[lead.address, lead.city].filter(Boolean).join(", ") || "No address yet"}</p>
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="muted">{notice}</p> : null}

      <div className="toolbar">
        <select
          value={lead.assigneeId ?? ""}
          onChange={(event) => {
            const userId = Number(event.target.value);
            if (userId) assign(userId);
          }}
          aria-label="Assign executive"
        >
          <option value="">{lead.assigneeId ? "Change executive" : "Assign executive"}</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
        {route ? (
          <a className="btn blue" href={route} target="_blank" rel="noreferrer">
            Follow map
          </a>
        ) : null}
      </div>

      <p className="muted">Click the map to drop the shop pin. The assigned executive uses this to navigate.</p>
      <MapView pins={pins} height={360} onPick={savePin} />
    </div>
  );
}
