import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ExecFilter, useExecutives, type ExecValue } from "../components/ExecFilter";
import { MapView } from "../components/MapView";
import { api, apiForm } from "../lib/api";
import { useAuth } from "../lib/auth";
import { looksLikeMapsLink, mapsUrl, parseMapsLink } from "../lib/maps";
import { mobileDigits } from "../lib/phone";

type Lead = {
  id: number;
  name: string;
  phone: string;
  status: string;
  approvalStatus?: string;
  createdByName?: string | null;
  assigneeId: number | null;
  assigneeName: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  beats?: { id: number; name: string; hq: string | null }[];
};

function execFromQuery(raw: string | null): ExecValue {
  if (!raw) return "all";
  if (raw === "unassigned") return "unassigned";
  const id = Number(raw);
  return id > 0 ? id : "all";
}

export function LeadsPage() {
  const { accessToken } = useAuth();
  const people = useExecutives();
  const [searchParams, setSearchParams] = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [q, setQ] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const geoSeq = useRef(0);
  const exec = execFromQuery(searchParams.get("assigneeId"));
  const pendingOnly = searchParams.get("approval") === "pending";

  function setExec(next: ExecValue) {
    const nextParams = new URLSearchParams(searchParams);
    if (next === "all") nextParams.delete("assigneeId");
    else nextParams.set("assigneeId", String(next));
    setSearchParams(nextParams, { replace: true });
  }

  async function load() {
    if (!accessToken) return;
    const assignee =
      exec === "all" ? "" : exec === "unassigned" ? "&assigneeId=unassigned" : `&assigneeId=${exec}`;
    const queue = pendingOnly ? "&filter=pending" : "";
    const data = await api<{ leads: Lead[] }>(`/leads?q=${encodeURIComponent(q)}${assignee}${queue}`, { token: accessToken });
    setLeads(data.leads);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, [accessToken, q, exec, pendingOnly]);

  function resetForm() {
    setName("");
    setPhone("");
    setContactPerson("");
    setAddress("");
    setCity("");
    setPin(null);
    setAssigneeId("");
  }

  async function findAddress(override?: string, quiet = false) {
    if (!accessToken) return;
    const query = (override ?? [address, city].filter(Boolean).join(", ")).trim();
    if (query.length < 3) {
      if (!quiet) setError("Type the shop address, or paste a Google Maps link.");
      return;
    }
    if (!quiet) setError("");
    const local = parseMapsLink(query);
    if (local) {
      setPin({ lat: local.lat, lng: local.lng });
      setNotice("Pin moved to the Google Maps link. Save the lead when ready.");
      return;
    }
    const seq = ++geoSeq.current;
    try {
      const hits = await api<{ lat: number; lng: number; kind?: string }[]>(`/geo?q=${encodeURIComponent(query)}`, {
        token: accessToken,
      });
      if (seq !== geoSeq.current) return;
      if (!hits.length) {
        if (!quiet) {
          setError(
            looksLikeMapsLink(query)
              ? "Could not read that Google Maps link. Open it in Chrome, copy the long URL from the address bar, or click the map."
              : "Could not find that address. Click the map to drop a pin.",
          );
        }
        return;
      }
      setError("");
      setPin({ lat: hits[0].lat, lng: hits[0].lng });
      setNotice(
        looksLikeMapsLink(query)
          ? "Pin moved to the Google Maps link. Save the lead when ready."
          : "Check the pin is on the shop. Click the map to move it.",
      );
    } catch (err) {
      if (seq !== geoSeq.current || quiet) return;
      setError(err instanceof Error ? err.message : "Could not find that address.");
    }
  }

  useEffect(() => {
    if (!adding || !accessToken) return;
    const query = [address, city].filter(Boolean).join(", ").trim();
    if (looksLikeMapsLink(query) || query.length < 5) return;
    const timer = window.setTimeout(() => {
      void findAddress(query, true);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [adding, address, city, accessToken]);

  function onAddressPaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").trim();
    if (!looksLikeMapsLink(pasted)) return;
    event.preventDefault();
    setAddress(pasted);
    void findAddress(pasted);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("This browser cannot share location. Click the map instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setPin({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError("Allow location, or click the map to drop the shop pin."),
    );
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/leads", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          name,
          phone,
          contactPerson: contactPerson || undefined,
          address: address || undefined,
          city: city || undefined,
          latitude: pin?.lat,
          longitude: pin?.lng,
          assigneeId: assigneeId ? Number(assigneeId) : undefined,
        }),
      });
      setNotice("Lead saved. The executive can open the map from this shop.");
      resetForm();
      setAdding(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the lead.");
    } finally {
      setBusy(false);
    }
  }

  async function decide(leadId: number, decision: "APPROVED" | "REJECTED") {
    if (!accessToken) return;
    setNotice("");
    setError("");
    try {
      await api(`/leads/${leadId}/approval`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ decision }),
      });
      setNotice(decision === "APPROVED" ? "Lead approved. The executive can visit it." : "Lead rejected.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update approval.");
    }
  }

  async function assign(leadId: number, userId: number | null) {
    if (!accessToken) return;
    setNotice("");
    setError("");
    try {
      const data = await api<{ beatNotice?: string }>(`/leads/${leadId}/assign`, {
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

  async function onImport(file?: File) {
    if (!file || !accessToken) return;
    setBusy(true);
    setNotice("");
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await apiForm<{ created: number; skipped: number }>(
        "/leads/import",
        { token: accessToken, form },
      );
      setNotice(`Imported ${result.created}. Skipped ${result.skipped}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <p className="kicker">Pipeline</p>
      <h1>Leads</h1>
      <p className="muted">
        Add a shop by hand, or import a sheet. Pin the location so the executive can follow the map to the visit.
      </p>
      <ExecFilter people={people} value={exec} onChange={setExec} includeUnassigned />
      <div className="toolbar">
        <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or phone" />
        <button className="btn green" type="button" onClick={() => setAdding((open) => !open)}>
          {adding ? "Close form" : "Add lead"}
        </button>
        <button
          className="btn blue"
          type="button"
          onClick={() => {
            const nextParams = new URLSearchParams(searchParams);
            if (pendingOnly) nextParams.delete("approval");
            else nextParams.set("approval", "pending");
            setSearchParams(nextParams, { replace: true });
          }}
        >
          {pendingOnly ? "Show all leads" : "Needs approval"}
        </button>
        <label className="btn blue file">
          {busy ? "Working…" : "Import Excel"}
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            hidden
            disabled={busy}
            onChange={(event) => {
              onImport(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      {notice ? <p className="muted">{notice}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {adding ? (
        <form className="card form wide" onSubmit={onCreate}>
          <div className="grid-2">
            <label>
              Business name *
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Shop or company" required />
            </label>
            <label>
              Phone *
              <input value={phone} onChange={(e) => setPhone(mobileDigits(e.target.value))} placeholder="10-digit mobile" inputMode="numeric" autoComplete="tel" required />
            </label>
            <label>
              Contact person
              <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Who you meet" />
            </label>
            <label>
              Assign executive
              <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                <option value="">Unassigned</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Address or Google Maps link
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onPaste={onAddressPaste}
                placeholder="Any street, area, or a Google Maps link"
              />
            </label>
            <label>
              City
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
            </label>
          </div>
          <div className="toolbar">
            <button className="btn blue" type="button" onClick={() => findAddress()}>
              Find address / map link
            </button>
            <button className="link" type="button" onClick={useMyLocation}>
              Use my location
            </button>
            {pin ? (
              <span className="muted">
                Pin {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
              </span>
            ) : (
              <span className="muted">Click the map to drop the shop pin.</span>
            )}
          </div>
          <MapView
            pins={pin ? [{ lat: pin.lat, lng: pin.lng, label: name || "New lead" }] : []}
            height={280}
            onPick={(lat, lng) => setPin({ lat, lng })}
          />
          <button className="btn green" disabled={busy}>
            {busy ? "Saving…" : "Save lead"}
          </button>
        </form>
      ) : null}

      <div className="list">
        {leads.map((lead) => {
          const place = [lead.address, lead.city].filter(Boolean).join(", ");
          const hasPin = lead.latitude != null && lead.longitude != null;
          const beatLine =
            lead.beats?.length
              ? lead.beats.map((b) => `${b.name}${b.hq ? ` · HQ ${b.hq}` : ""}`).join(" · ")
              : "No beat";
          return (
            <article key={lead.id} className="card person">
              <div>
                <strong>
                  <Link to={`/leads/${lead.id}`}>{lead.name}</Link>
                </strong>
                <div className="muted">
                  {beatLine}
                </div>
                <div className="muted">
                  {lead.phone} · {place || "No address"} · {lead.assigneeName || "Unassigned"}
                  {lead.createdByName ? ` · Added by ${lead.createdByName}` : ""}
                  {hasPin ? " · Map pin" : ""}
                </div>
              </div>
              <div className="right">
                <span className="muted">
                  {lead.approvalStatus === "PENDING"
                    ? "Needs approval"
                    : lead.approvalStatus === "REJECTED"
                      ? "Rejected"
                      : lead.status}
                </span>
                {lead.approvalStatus === "PENDING" ? (
                  <>
                    <button className="btn green" type="button" onClick={() => decide(lead.id, "APPROVED")}>
                      Approve
                    </button>
                    <button className="btn red" type="button" onClick={() => decide(lead.id, "REJECTED")}>
                      Reject
                    </button>
                  </>
                ) : null}
                <select
                  value={lead.assigneeId ?? ""}
                  onChange={(event) => {
                    const raw = event.target.value;
                    if (raw === "") {
                      if (lead.assigneeId) assign(lead.id, null);
                      return;
                    }
                    const userId = Number(raw);
                    if (userId && userId !== lead.assigneeId) assign(lead.id, userId);
                  }}
                  aria-label={`Assign ${lead.name}`}
                >
                  <option value="">
                    {lead.assigneeId ? "Unassign (also removes from their beats)" : "Assign executive"}
                  </option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
                <Link className="btn blue" to={`/leads/${lead.id}`}>
                  Edit
                </Link>
                {hasPin || place ? (
                  <a
                    href={
                      mapsUrl({
                        latitude: lead.latitude,
                        longitude: lead.longitude,
                        address: lead.address,
                        city: lead.city,
                        name: lead.name,
                        mode: "dir",
                      }) ?? undefined
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Follow map
                  </a>
                ) : null}
              </div>
            </article>
          );
        })}
        {!leads.length ? <p className="muted">No leads match this executive.</p> : null}
      </div>
    </div>
  );
}
