import { useEffect, useState, type ClipboardEvent, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { MapView } from "../components/MapView";
import { useExecutives } from "../components/ExecFilter";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { looksLikeMapsLink, mapsUrl as buildMapsUrl, parseMapsLink } from "../lib/maps";
import { mobileDigits } from "../lib/phone";

type Lead = {
  id: number;
  name: string;
  phone: string;
  contactPerson: string | null;
  businessType: string | null;
  notes: string | null;
  potential: number | null;
  temperature: "HOT" | "WARM" | "COLD";
  address: string | null;
  mapsLink?: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  approvalStatus?: string;
  rejectionNote?: string | null;
  createdByName?: string | null;
  assigneeId: number | null;
  assigneeName: string | null;
};

function mapsUrl(lead: Lead) {
  if (lead.mapsLink && (lead.latitude == null || lead.longitude == null)) return lead.mapsLink;
  return buildMapsUrl({
    latitude: lead.latitude,
    longitude: lead.longitude,
    address: lead.address,
    city: lead.city,
    name: lead.name,
    mode: "dir",
  });
}

type GeoHit = { lat: number; lng: number; label: string; kind: string };

export function LeadDetailPage() {
  const { id } = useParams();
  const { accessToken } = useAuth();
  const people = useExecutives();
  const [lead, setLead] = useState<Lead | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [address, setAddress] = useState("");
  const [mapsLink, setMapsLink] = useState("");
  const [city, setCity] = useState("");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [matches, setMatches] = useState<GeoHit[]>([]);
  const [saving, setSaving] = useState(false);
  const [finding, setFinding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    contactPerson: "",
    businessType: "",
    potential: "",
    temperature: "WARM" as Lead["temperature"],
    notes: "",
  });

  function applyLead(next: Lead) {
    setLead(next);
    setForm({
      name: next.name,
      phone: next.phone,
      contactPerson: next.contactPerson ?? "",
      businessType: next.businessType ?? "",
      potential: next.potential != null ? String(next.potential) : "",
      temperature: next.temperature ?? "WARM",
      notes: next.notes ?? "",
    });
    setAddress(next.address ?? "");
    setMapsLink(next.mapsLink ?? "");
    setCity(next.city ?? "");
    setPin(next.latitude != null && next.longitude != null ? { lat: next.latitude, lng: next.longitude } : null);
  }

  async function load() {
    if (!accessToken || !id) return;
    applyLead(await api<Lead>(`/leads/${id}`, { token: accessToken }));
  }

  useEffect(() => {
    load().catch(() => setError("Could not load this lead."));
  }, [accessToken, id]);

  async function decide(decision: "APPROVED" | "REJECTED") {
    if (!accessToken || !lead) return;
    setError("");
    setNotice("");
    try {
      setLead(
        await api<Lead>(`/leads/${lead.id}/approval`, {
          method: "POST",
          token: accessToken,
          body: JSON.stringify({ decision }),
        }),
      );
      setNotice(decision === "APPROVED" ? "Lead approved. The executive can visit it." : "Lead rejected.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update approval.");
    }
  }

  async function assign(userId: number | null) {
    if (!accessToken || !lead) return;
    setError("");
    setNotice("");
    try {
      const data = await api<{ beatNotice?: string }>(`/leads/${lead.id}/assign`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ userId }),
      });
      if (data.beatNotice) setNotice(data.beatNotice);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign.");
    }
  }

  async function saveDetails(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !lead) return;
    if (form.phone.length !== 10) {
      setError("Enter a 10-digit mobile number.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      applyLead(
        await api<Lead>(`/leads/${lead.id}`, {
          method: "PUT",
          token: accessToken,
          body: JSON.stringify({
            name: form.name.trim(),
            phone: form.phone,
            contactPerson: form.contactPerson.trim(),
            businessType: form.businessType.trim(),
            potential: form.potential ? Number(form.potential) : null,
            temperature: form.temperature,
            notes: form.notes.trim(),
          }),
        }),
      );
      setEditing(false);
      setNotice("Lead details saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the lead.");
    } finally {
      setSaving(false);
    }
  }

  async function findAddress(override?: string) {
    if (!accessToken) return;
    const typed = [address, city].filter(Boolean).join(", ").trim();
    const query = (override ?? (typed || mapsLink.trim())).trim();
    setError("");
    setNotice("");
    setMatches([]);
    if (query.length < 3) {
      setError("Type the shop address, or paste a Google Maps link.");
      return;
    }
    const local = parseMapsLink(query);
    if (local) {
      setPin({ lat: local.lat, lng: local.lng });
      setMatches([{ lat: local.lat, lng: local.lng, label: local.label, kind: "coordinates" }]);
      setNotice("Pin moved to the Google Maps link. Click Save location.");
      return;
    }
    setFinding(true);
    try {
      const hits = await api<GeoHit[]>(`/geo?q=${encodeURIComponent(query)}`, { token: accessToken });
      if (!hits.length) {
        setError(
          looksLikeMapsLink(query)
            ? "Could not read that Google Maps link. Open the link in Chrome, copy the long URL from the address bar, paste here, then Find again — or click the shop on the map."
            : "No match for that address. Click the exact shop on the map.",
        );
        return;
      }
      setMatches(hits);
      setPin({ lat: hits[0].lat, lng: hits[0].lng });
      setNotice(
        hits[0].kind === "coordinates" || looksLikeMapsLink(query)
          ? "Pin moved to the Google Maps link. Click Save location."
          : "Address found — confirm the pin on the map, then save.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not search that address.");
    } finally {
      setFinding(false);
    }
  }

  function onMapsPaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").trim();
    if (!looksLikeMapsLink(pasted)) return;
    event.preventDefault();
    setMapsLink(pasted);
    void findAddress(pasted);
  }

  function onAddressPaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").trim();
    if (!looksLikeMapsLink(pasted)) return;
    event.preventDefault();
    setMapsLink(pasted);
    void findAddress(pasted);
  }

  function useMyLocation() {
    setError("");
    if (!navigator.geolocation) {
      setError("This browser cannot share location. Click the map instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setPin({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError("Allow location, or click the exact shop on the map."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function saveLocation() {
    if (!accessToken || !lead) return;
    if (!pin && !address.trim() && !mapsLink.trim()) {
      setError("Enter the address or paste a Google Maps link.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      applyLead(
        await api<Lead>(`/leads/${lead.id}`, {
          method: "PUT",
          token: accessToken,
          body: JSON.stringify({
            address: address.trim(),
            mapsLink: mapsLink.trim(),
            city: city.trim(),
            ...(pin ? { latitude: pin.lat, longitude: pin.lng } : {}),
          }),
        }),
      );
      setMatches([]);
      setNotice("Location saved. The executive finishes the visit within 300 m of this pin.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the location.");
    } finally {
      setSaving(false);
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
  const pins = pin ? [{ lat: pin.lat, lng: pin.lng, label: lead.name, extra: [address, city].filter(Boolean).join(", ") }] : [];
  const moved =
    pin != null && (lead.latitude == null || lead.longitude == null || pin.lat !== lead.latitude || pin.lng !== lead.longitude);
  const edited =
    moved || address !== (lead.address ?? "") || mapsLink !== (lead.mapsLink ?? "") || city !== (lead.city ?? "");

  return (
    <div className="page">
      <p className="kicker">
        <Link to="/leads">Pipeline</Link>
      </p>
      <h1>{lead.name}</h1>
      <p className="muted">
        {lead.phone}
        {lead.contactPerson ? ` · ${lead.contactPerson}` : ""} · {lead.assigneeName || "Unassigned"} ·{" "}
        {lead.approvalStatus === "PENDING"
          ? "Needs approval"
          : lead.approvalStatus === "REJECTED"
            ? "Rejected"
            : lead.status}
        {lead.createdByName ? ` · Added by ${lead.createdByName}` : ""}
      </p>
      {lead.approvalStatus === "PENDING" ? (
        <div className="toolbar">
          <button className="btn green" type="button" onClick={() => decide("APPROVED")}>
            Approve
          </button>
          <button className="btn red" type="button" onClick={() => decide("REJECTED")}>
            Reject
          </button>
        </div>
      ) : null}
      {lead.approvalStatus === "REJECTED" && lead.rejectionNote ? <p className="error">{lead.rejectionNote}</p> : null}
      <p className="muted">
        {[lead.address, lead.city].filter(Boolean).join(", ") || "No address yet"}
        {lead.mapsLink ? (
          <>
            {" · "}
            <a href={lead.mapsLink} target="_blank" rel="noreferrer">
              Google Maps link
            </a>
          </>
        ) : null}
      </p>
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="muted">{notice}</p> : null}

      <div className="toolbar">
        <select
          value={lead.assigneeId ?? ""}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === "") {
              if (lead.assigneeId) assign(null);
              return;
            }
            const userId = Number(raw);
            if (userId && userId !== lead.assigneeId) assign(userId);
          }}
          aria-label="Assign executive"
        >
          <option value="">{lead.assigneeId ? "Unassign (also removes from their beats)" : "Assign executive"}</option>
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
        <button className="btn green" type="button" onClick={() => setEditing((open) => !open)}>
          {editing ? "Close edit" : "Edit lead"}
        </button>
      </div>

      {editing ? (
        <form className="card form wide" onSubmit={saveDetails}>
          <h2>Edit lead</h2>
          <div className="grid-2">
            <label>
              Business name *
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label>
              Phone *
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: mobileDigits(e.target.value) })}
                inputMode="numeric"
                autoComplete="tel"
                placeholder="10-digit mobile"
                required
              />
            </label>
            <label>
              Contact person
              <input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
            </label>
            <label>
              Business type
              <input value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })} />
            </label>
            <label>
              Potential (₹)
              <input
                value={form.potential}
                onChange={(e) => setForm({ ...form, potential: e.target.value.replace(/[^\d.]/g, "") })}
                inputMode="decimal"
              />
            </label>
            <label>
              Temperature
              <select
                value={form.temperature}
                onChange={(e) => setForm({ ...form, temperature: e.target.value as Lead["temperature"] })}
              >
                <option value="HOT">Hot</option>
                <option value="WARM">Warm</option>
                <option value="COLD">Cold</option>
              </select>
            </label>
          </div>
          <label>
            Notes
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
          </label>
          <p className="muted">Change the address and map pin in Shop location below.</p>
          <button className="btn green" disabled={saving}>
            {saving ? "Saving…" : "Save details"}
          </button>
        </form>
      ) : null}

      <section className="card form wide">
        <h2>Shop location</h2>
        <p className="muted">
          The executive can start the visit anywhere. Finishing it needs the phone within 300 m of this pin, so place it on the
          exact shop.
        </p>
        <div className="grid-2">
          <label>
            Address
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onPaste={onAddressPaste}
              placeholder="Street, area, landmark"
            />
          </label>
          <label>
            City
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
          </label>
        </div>
        <label>
          Google Maps link
          <input
            value={mapsLink}
            onChange={(e) => setMapsLink(e.target.value)}
            onPaste={onMapsPaste}
            placeholder="https://maps.app.goo.gl/…"
            inputMode="url"
            autoComplete="off"
          />
        </label>
        <p className="muted">
          The address is the street text. Pasting a Google Maps link moves the pin to that place and is saved on its own.
          “Use my location” is only your live GPS — do not use it if you already pasted a shop link.
        </p>
        <div className="toolbar">
          <button className="btn blue" type="button" onClick={() => findAddress()} disabled={finding}>
            {finding ? "Reading map link…" : "Find on map"}
          </button>
          <button className="link" type="button" onClick={useMyLocation}>
            Use my location
          </button>
          <span className="muted">
            {pin ? `Pin ${pin.lat.toFixed(6)}, ${pin.lng.toFixed(6)}` : "No pin yet. Click the shop on the map."}
          </span>
        </div>
        {matches.length > 1 ? (
          <div className="pick-list">
            {matches.map((hit) => (
              <button key={`${hit.lat},${hit.lng}`} type="button" onClick={() => setPin({ lat: hit.lat, lng: hit.lng })}>
                {hit.label}
              </button>
            ))}
          </div>
        ) : null}
        <MapView pins={pins} height={360} onPick={(lat, lng) => setPin({ lat, lng })} />
        <p className="muted">Click the map to move the pin, then save.</p>
        <button className="btn green" type="button" onClick={saveLocation} disabled={saving || !edited}>
          {saving ? "Saving…" : "Save location"}
        </button>
      </section>
    </div>
  );
}
