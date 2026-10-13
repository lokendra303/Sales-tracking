import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, apiBlob } from "../lib/api";
import { useAuth } from "../lib/auth";
import { MapView } from "../components/MapView";
import type { Visit } from "../lib/types";

export function VisitDetailPage() {
  const { id } = useParams();
  const { accessToken } = useAuth();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [bill, setBill] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!accessToken || !id) return;
    const data = await api<Visit>(`/visits/${id}`, { token: accessToken });
    setVisit(data);
    if (data.hasPhoto) {
      setPhoto(await apiBlob(`/visits/${data.id}/photo`, accessToken).catch(() => null));
    }
    if (data.saleId && data.saleHasBill) {
      setBill(await apiBlob(`/sales/${data.saleId}/bill`, accessToken).catch(() => null));
    }
  }

  useEffect(() => {
    load().catch(() => setError("Could not load this visit."));
  }, [accessToken, id]);

  async function confirm() {
    if (!accessToken || !visit) return;
    setBusy(true);
    setError("");
    try {
      setVisit(await api<Visit>(`/visits/${visit.id}/confirm`, { method: "POST", token: accessToken }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm.");
    } finally {
      setBusy(false);
    }
  }

  if (!visit) return <div className="page">{error || "Loading…"}</div>;

  const pins = [
    visit.placeLat != null && visit.placeLng != null
      ? { lat: visit.placeLat, lng: visit.placeLng, label: `${visit.name} pin`, extra: "Shop pin" }
      : null,
    visit.checkinLat != null && visit.checkinLng != null
      ? {
          lat: visit.checkinLat,
          lng: visit.checkinLng,
          label: "Check-in",
          extra: `${new Date(visit.checkedInAt).toLocaleString()}${visit.checkinDistanceMeters != null ? ` · ${visit.checkinDistanceMeters} m from pin` : ""}`,
        }
      : null,
    visit.photoLat != null && visit.photoLng != null
      ? { lat: visit.photoLat, lng: visit.photoLng, label: "Photo GPS", extra: visit.photoCapturedAt ? new Date(visit.photoCapturedAt).toLocaleString() : "" }
      : null,
    visit.checkoutLat != null && visit.checkoutLng != null
      ? {
          lat: visit.checkoutLat,
          lng: visit.checkoutLng,
          label: "Finish",
          extra: `${visit.checkedOutAt ? new Date(visit.checkedOutAt).toLocaleString() : ""}${visit.finishDistanceMeters != null ? ` · ${visit.finishDistanceMeters} m from pin` : ""}`,
        }
      : null,
  ].filter(Boolean) as { lat: number; lng: number; label: string; extra?: string }[];

  const mapLink = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`;
  const places = [
    {
      label: "Check-in",
      lat: visit.checkinLat,
      lng: visit.checkinLng,
      distance: visit.checkinDistanceMeters ?? null,
      accuracy: visit.checkinAccuracy ?? null,
      empty: "No GPS saved",
    },
    { label: "Photo", lat: visit.photoLat, lng: visit.photoLng, distance: null, accuracy: visit.photoAccuracy ?? null, empty: "No photo yet" },
    {
      label: "Finish",
      lat: visit.checkoutLat ?? null,
      lng: visit.checkoutLng ?? null,
      distance: visit.finishDistanceMeters ?? null,
      accuracy: visit.checkoutAccuracy ?? null,
      empty: visit.status === "IN_PROGRESS" ? "Not finished yet" : "Not saved for this older visit",
    },
  ];

  const canConfirm = visit.status === "COMPLETED" && visit.outcome === "SUCCESS" && visit.hasPhoto && !visit.managerConfirmedAt;

  return (
    <div className="page">
      <Link to="/visits">← Visits</Link>
      <h1>{visit.name}</h1>
      <p className="muted">
        {visit.userName} · checked in {new Date(visit.checkedInAt).toLocaleString()}
        {visit.checkedOutAt ? ` · finished ${new Date(visit.checkedOutAt).toLocaleString()}` : ""}
      </p>
      <div className="grid">
        <article className="card">
          <h2>Proof</h2>
          {photo ? <img className="proof" src={photo} alt="Place photo" /> : <p className="muted">No place photo.</p>}
          <p className={visit.verified ? "on" : "off"}>
            {visit.distanceMeters != null ? `${visit.distanceMeters} m from pin` : "No shop pin"}
            {visit.verified ? " · Verified" : " · Not verified"}
          </p>
          {visit.notes ? <p>{visit.notes}</p> : null}
          {visit.saleAmount != null ? <p className="on">Sale ₹{visit.saleAmount}</p> : null}
          {bill ? (
            <>
              <h3>Bill photo</h3>
              <img className="proof" src={bill} alt="Bill photo" />
            </>
          ) : null}
          {visit.managerConfirmedAt ? (
            <p className="on">Confirmed {new Date(visit.managerConfirmedAt).toLocaleString()}</p>
          ) : canConfirm ? (
            <button className="btn green" onClick={confirm} disabled={busy}>
              Confirm visit
            </button>
          ) : null}
          {error ? <p className="error">{error}</p> : null}
        </article>
        <article className="card">
          <h2>Locations</h2>
          {pins.length ? <MapView pins={pins} height={280} /> : <p className="muted">No GPS on this visit.</p>}
          <ul className="access">
            {places.map((place) => (
              <li key={place.label}>
                <strong>{place.label}</strong>
                {place.lat != null && place.lng != null ? (
                  <span className="muted">
                    {place.distance != null ? `${place.distance} m from shop pin` : "Saved"}
                    {place.accuracy != null ? ` · GPS ±${Math.round(place.accuracy)} m` : ""}
                    {" · "}
                    <a href={mapLink(place.lat, place.lng)} target="_blank" rel="noreferrer">
                      Open map
                    </a>
                  </span>
                ) : (
                  <span className="muted">{place.empty}</span>
                )}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </div>
  );
}
