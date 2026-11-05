import { Fragment, useEffect, useMemo, useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ExecFilter, useExecutives, type ExecValue } from "../components/ExecFilter";
import { MapView } from "../components/MapView";
import { api, apiForm } from "../lib/api";
import { useAuth } from "../lib/auth";
import { looksLikeMapsLink, mapsUrl, parseMapsLink } from "../lib/maps";
import { mobileDigits } from "../lib/phone";

type ImportPlace = {
  beatId: number;
  beatName: string;
  hq: string | null;
  count: number;
};

type ImportRow = {
  row: number;
  name: string;
  phone: string;
  rawPhone: string;
  contactPerson: string;
  businessType: string;
  address: string;
  city: string;
  beatName: string;
  hqName: string;
  ready: boolean;
  reason: string;
};

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
  mapsLink?: string | null;
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
  const [picked, setPicked] = useState<number[]>([]);
  const [q, setQ] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [address, setAddress] = useState("");
  const [mapsLink, setMapsLink] = useState("");
  const [city, setCity] = useState("");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [beats, setBeats] = useState<{ id: number; name: string; territory?: string | null; assigneeName: string | null }[]>([]);
  const [hqs, setHqs] = useState<{ id: number; name: string; beatCount: number }[]>([]);
  const [importHq, setImportHq] = useState("");
  const [beatId, setBeatId] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importNote, setImportNote] = useState("");
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [importPlaces, setImportPlaces] = useState<ImportPlace[]>([]);
  const [moveChoice, setMoveChoice] = useState<Record<number, string>>({});
  const geoSeq = useRef(0);
  const addFormRef = useRef<HTMLFormElement>(null);
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

  function loadImportPlaces() {
    if (!accessToken) return Promise.resolve();
    return api<ImportPlace[]>("/leads/import/places", { token: accessToken })
      .then(setImportPlaces)
      .catch(() => setImportPlaces([]));
  }

  useEffect(() => {
    if (!accessToken) return;
    api<{ id: number; name: string; territory?: string | null; assigneeName: string | null }[]>("/beats", { token: accessToken })
      .then(setBeats)
      .catch(() => setBeats([]));
    api<{ id: number; name: string; beatCount: number }[]>("/hqs", { token: accessToken })
      .then(setHqs)
      .catch(() => setHqs([]));
    loadImportPlaces();
  }, [accessToken]);

  useEffect(() => {
    if (adding) addFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [adding]);

  function resetForm() {
    setName("");
    setPhone("");
    setContactPerson("");
    setAddress("");
    setMapsLink("");
    setCity("");
    setPin(null);
    setBeatId("");
  }

  async function findAddress(override?: string, quiet = false) {
    if (!accessToken) return;
    const typed = [address, city].filter(Boolean).join(", ").trim();
    const query = (override ?? (typed || mapsLink.trim())).trim();
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
    const link = mapsLink.trim();
    if (looksLikeMapsLink(link)) {
      const timer = window.setTimeout(() => {
        void findAddress(link, true);
      }, 400);
      return () => window.clearTimeout(timer);
    }
    const query = [address, city].filter(Boolean).join(", ").trim();
    if (query.length < 5) return;
    const timer = window.setTimeout(() => {
      void findAddress(query, true);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [adding, address, city, mapsLink, accessToken]);

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
    if (!name.trim()) {
      setError("Enter the business name.");
      return;
    }
    if (phone && phone.length !== 10) {
      setError("Enter a 10-digit mobile number, or leave it blank.");
      return;
    }
    if (!beatId) {
      setError("Pick a beat. Each beat already belongs to an HQ.");
      return;
    }
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
          mapsLink: mapsLink || undefined,
          city: city || undefined,
          latitude: pin?.lat,
          longitude: pin?.lng,
          beatId: beatId ? Number(beatId) : undefined,
        }),
      });
      setNotice("Lead saved on that beat. The salesperson is whoever the beat is assigned to.");
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

  const importGroups = useMemo(() => {
    const groups = new Map<string, ImportRow[]>();
    for (const row of importRows) {
      const shops = groups.get(row.beatName) ?? [];
      shops.push(row);
      groups.set(row.beatName, shops);
    }
    return [...groups.entries()].map(([beatName, shops]) => ({
      beatName,
      shops,
      count: shops.filter((shop) => shop.ready).length,
    }));
  }, [importRows]);

  const shopsToAdd = importGroups.reduce((sum, group) => sum + (group.beatName.trim() ? group.count : 0), 0);
  const shopsWithoutBeat = importGroups.reduce((sum, group) => sum + (group.beatName.trim() ? 0 : group.count), 0);

  function clearImport() {
    setImportFile(null);
    setImportRows([]);
    setImportNote("");
    setImportHq("");
    setOpenGroups([]);
  }

  function removeImportShop(rowNumber: number) {
    setImportRows((current) => current.filter((row) => row.row !== rowNumber));
  }

  async function onImport(file?: File) {
    if (!file || !accessToken) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await apiForm<{ rows: ImportRow[]; ready: number; skipped: number; sheetName?: string; note?: string }>(
        "/leads/import/preview",
        { token: accessToken, form },
      );
      if (!result.rows.length) {
        setError("That sheet has no shop rows.");
        clearImport();
        return;
      }
      const [deskBeats, deskHqs] = await Promise.all([
        api<{ id: number; name: string; territory?: string | null; assigneeName: string | null }[]>("/beats", { token: accessToken }),
        api<{ id: number; name: string; beatCount: number }[]>("/hqs", { token: accessToken }),
      ]);
      setBeats(deskBeats);
      setHqs(deskHqs);
      const sheetHq = result.rows.find((row) => row.hqName.trim())?.hqName.trim().toLowerCase();
      const matchedHq = sheetHq ? deskHqs.find((hq) => hq.name.trim().toLowerCase() === sheetHq) : undefined;
      setImportFile(file);
      setImportRows(result.rows);
      setImportNote(result.note ?? "");
      setImportHq(matchedHq ? String(matchedHq.id) : "");
      setOpenGroups([]);
      setNotice(
        result.ready
          ? `${result.ready} shops are in the sheet. Choose the headquarters and the beats will be created there.`
          : "Nothing in this sheet can be added. Open a beat and check the shop reasons.",
      );
    } catch (err) {
      clearImport();
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!importFile || !accessToken) return;
    const hqId = Number(importHq);
    if (!hqId) {
      setError("Choose the headquarters these beats should join.");
      return;
    }
    if (!shopsToAdd) {
      setError("No shops in this sheet can be added.");
      return;
    }
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const form = new FormData();
      form.append("file", importFile);
      form.append("hqId", String(hqId));
      form.append(
        "keepRows",
        JSON.stringify(importRows.filter((row) => row.ready && row.beatName.trim()).map((row) => row.row)),
      );
      const result = await apiForm<{ created: number; skipped: number; beatsCreated: number }>(
        "/leads/import",
        { token: accessToken, form },
      );
      const hqName = hqs.find((hq) => hq.id === hqId)?.name ?? "that headquarters";
      clearImport();
      setNotice(
        `Created ${result.beatsCreated} beat${result.beatsCreated === 1 ? "" : "s"} under ${hqName} and added ${result.created} shop${result.created === 1 ? "" : "s"}. Skipped ${result.skipped}.`,
      );
      const deskBeats = await api<{ id: number; name: string; territory?: string | null; assigneeName: string | null }[]>("/beats", {
        token: accessToken,
      });
      setBeats(deskBeats);
      await Promise.all([load(), loadImportPlaces()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  async function deletePicked() {
    if (!accessToken || !picked.length) return;
    const count = picked.length;
    const ok = window.confirm(
      count === 1
        ? "Delete this lead? It is removed from its beat. This cannot be undone."
        : `Delete ${count} leads? They are removed from their beats. This cannot be undone.`,
    );
    if (!ok) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const result = await api<{ deleted: number }>("/leads/delete", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ ids: picked }),
      });
      setPicked([]);
      setNotice(`Deleted ${result.deleted} lead${result.deleted === 1 ? "" : "s"}.`);
      await Promise.all([load(), loadImportPlaces()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete those leads.");
    } finally {
      setBusy(false);
    }
  }

  async function moveImported(fromBeatId: number) {
    if (!accessToken) return;
    const toBeatId = Number(moveChoice[fromBeatId]);
    if (!toBeatId) {
      setError("Choose the beat these shops should move to.");
      return;
    }
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const result = await api<{ moved: number; to: string }>("/leads/import/move", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ fromBeatId, toBeatId }),
      });
      setMoveChoice((current) => ({ ...current, [fromBeatId]: "" }));
      setNotice(`Moved ${result.moved} shops to ${result.to}.`);
      await Promise.all([load(), loadImportPlaces()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not move those shops.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <p className="kicker">Pipeline</p>
      <h1>Leads</h1>
      <p className="muted">
        {leads.length} lead{leads.length === 1 ? "" : "s"}. Import the Excel, choose the headquarters, and the beats are created there with their shops.
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
        <form className="card form wide" ref={addFormRef} onSubmit={onCreate}>
          <div className="grid-2">
            <label>
              Business name *
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Shop or company" required />
            </label>
            <label>
              Phone
              <input value={phone} onChange={(e) => setPhone(mobileDigits(e.target.value))} placeholder="10-digit mobile, optional" inputMode="numeric" autoComplete="tel" />
            </label>
            <label>
              Contact person
              <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Who you meet" />
            </label>
            <label>
              Beat
              <select value={beatId} onChange={(e) => setBeatId(e.target.value)} required>
                <option value="">Select a beat</option>
                {beats.map((beat) => (
                  <option key={beat.id} value={beat.id}>
                    {beat.name} · {beat.territory?.trim() || "No HQ"} · {beat.assigneeName || "No salesperson yet"}
                  </option>
                ))}
              </select>
              <span className="muted">Every beat is listed, assigned or not. You do not pick a person here.</span>
            </label>
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
          <div className="toolbar">
            <button className="btn blue" type="button" onClick={() => findAddress()}>
              Find on map
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

      {importPlaces.length ? (
        <section className="card form wide">
          <h2>Move a wrong group</h2>
          <p className="muted">
            These shops are already on a beat. If a group landed on the wrong beat, choose the right beat and move the whole group. Shops you added by hand stay where they are.
          </p>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Currently on</th>
                  <th>Shops</th>
                  <th>Move to</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {importPlaces.map((place) => (
                  <tr key={place.beatId}>
                    <td>
                      {place.beatName}
                      {place.hq ? <div className="muted">{place.hq}</div> : null}
                    </td>
                    <td>{place.count}</td>
                    <td>
                      <select
                        value={moveChoice[place.beatId] ?? ""}
                        onChange={(event) => setMoveChoice((current) => ({ ...current, [place.beatId]: event.target.value }))}
                      >
                        <option value="">Choose the right beat</option>
                        {beats
                          .filter((beat) => beat.id !== place.beatId)
                          .map((beat) => (
                            <option key={beat.id} value={beat.id}>
                              {beat.name}
                              {beat.territory ? ` · ${beat.territory}` : ""}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td>
                      <button
                        className="btn"
                        type="button"
                        disabled={busy || !moveChoice[place.beatId]}
                        onClick={() => moveImported(place.beatId)}
                      >
                        Move
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {importRows.length ? (
        <section className="card form wide">
          <div className="toolbar">
            <h2 style={{ margin: 0 }}>Shops from the sheet</h2>
            <button className="btn" type="button" disabled={busy} onClick={clearImport}>
              Close
            </button>
          </div>
          <p className="muted">
            {importNote ? `${importNote} ` : ""}
            Choose one headquarters. Each beat name on the sheet becomes a beat under it, and the shops go on that beat. A shop is still added when its mobile is missing or not 10 digits. Open the shop count to see the shops and remove any you do not want. Nothing is saved until you click Create.
          </p>
          <label>
            Headquarters
            <select value={importHq} onChange={(event) => setImportHq(event.target.value)}>
              <option value="">Choose the headquarters</option>
              {hqs.map((hq) => (
                <option key={hq.id} value={hq.id}>
                  {hq.name}
                </option>
              ))}
            </select>
          </label>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Beat on the sheet</th>
                  <th>Shops</th>
                </tr>
              </thead>
              <tbody>
                {importGroups.map((group) => {
                  const open = openGroups.includes(group.beatName);
                  return (
                    <Fragment key={group.beatName || "none"}>
                      <tr>
                        <td>{group.beatName || "No beat name"}</td>
                        <td>
                          <button
                            className="btn"
                            type="button"
                            onClick={() =>
                              setOpenGroups((current) =>
                                open ? current.filter((name) => name !== group.beatName) : [...current, group.beatName],
                              )
                            }
                          >
                            {open ? "Hide" : "Show"} {group.count}
                          </button>
                        </td>
                      </tr>
                      {open ? (
                        <tr>
                          <td colSpan={2}>
                            <div className="list">
                              {group.shops.map((shop) => (
                                <div key={shop.row} className="person" style={{ padding: "8px 0" }}>
                                  <span>
                                    <strong>{shop.name || "No name"}</strong>
                                    <div className="muted">
                                      {shop.phone || shop.rawPhone || "No mobile"}
                                      {shop.city ? ` · ${shop.city}` : ""}
                                      {shop.businessType ? ` · ${shop.businessType}` : ""}
                                    </div>
                                    <div className="muted">
                                      {shop.ready
                                        ? group.beatName.trim()
                                          ? importHq
                                            ? "Will be added"
                                            : "Choose a headquarters"
                                          : "Skipped · no beat name"
                                        : shop.reason}
                                    </div>
                                  </span>
                                  <button className="btn red" type="button" onClick={() => removeImportShop(shop.row)}>
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="toolbar">
            <button className="btn green" type="button" disabled={busy || !importHq || !shopsToAdd} onClick={() => confirmImport()}>
              {busy ? "Working…" : `Create the beats and add ${shopsToAdd} shops`}
            </button>
            <button className="btn" type="button" disabled={busy} onClick={clearImport}>
              Close
            </button>
          </div>
          {shopsWithoutBeat ? (
            <p className="muted">{shopsWithoutBeat} shops have no beat name, so they will not be added.</p>
          ) : null}
        </section>
      ) : null}

      <div className="toolbar">
        <label className="check-row" style={{ margin: 0 }}>
          <input
            type="checkbox"
            checked={leads.length > 0 && leads.every((lead) => picked.includes(lead.id))}
            onChange={(event) => setPicked(event.target.checked ? leads.map((lead) => lead.id) : [])}
            disabled={!leads.length}
          />
          <span>Select all</span>
        </label>
        <button className="btn red" type="button" disabled={busy || !picked.length} onClick={() => deletePicked()}>
          {picked.length ? `Delete selected (${picked.length})` : "Delete selected"}
        </button>
      </div>
      <div className="list">
        {leads.map((lead) => {
          const place = [lead.address, lead.city].filter(Boolean).join(", ");
          const placeLine = place || (lead.mapsLink ? "Map link saved" : "No address");
          const hasPin = lead.latitude != null && lead.longitude != null;
          const beatLine =
            lead.beats?.length
              ? lead.beats.map((b) => `${b.name}${b.hq ? ` · HQ ${b.hq}` : ""}`).join(" · ")
              : "No beat";
          return (
            <article key={lead.id} className="card person">
              <div>
                <label className="check-row" style={{ margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={picked.includes(lead.id)}
                    onChange={(event) =>
                      setPicked((current) =>
                        event.target.checked ? [...current, lead.id] : current.filter((id) => id !== lead.id),
                      )
                    }
                    aria-label={`Select ${lead.name}`}
                  />
                  <span>
                    <strong>
                      <Link to={`/leads/${lead.id}`}>{lead.name}</Link>
                    </strong>
                    <div className="muted">{beatLine}</div>
                    <div className="muted">
                      {lead.phone ? `${lead.phone} · ` : ""}{placeLine}
                      {place && lead.mapsLink ? " · Map link" : ""} · {lead.assigneeName || "Unassigned"}
                      {lead.createdByName ? ` · Added by ${lead.createdByName}` : ""}
                      {hasPin ? " · Map pin" : ""}
                    </div>
                  </span>
                </label>
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
                {hasPin || place || lead.mapsLink ? (
                  <a
                    href={
                      (lead.latitude == null && lead.mapsLink
                        ? lead.mapsLink
                        : mapsUrl({
                            latitude: lead.latitude,
                            longitude: lead.longitude,
                            address: lead.address,
                            city: lead.city,
                            name: lead.name,
                            mode: "dir",
                          })) ?? undefined
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
