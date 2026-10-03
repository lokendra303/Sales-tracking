import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapPin = { lat: number; lng: number; label: string; extra?: string };

export function MapView({
  pins,
  height = 460,
  onPick,
}: {
  pins: MapPin[];
  height?: number;
  onPick?: (lat: number, lng: number) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const marks = useRef<L.CircleMarker[]>([]);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const key = pins.map((pin) => `${pin.lat},${pin.lng},${pin.label}`).join("|");

  useEffect(() => {
    if (!el.current) return;
    if (!mapRef.current) {
      mapRef.current = L.map(el.current).setView([28.6139, 77.209], 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
      }).addTo(mapRef.current);
      mapRef.current.on("click", (event: L.LeafletMouseEvent) => {
        pickRef.current?.(event.latlng.lat, event.latlng.lng);
      });
    }
    const map = mapRef.current;
    marks.current.forEach((marker) => marker.remove());
    marks.current = [];
    const valid = pins.filter((pin) => Number.isFinite(pin.lat) && Number.isFinite(pin.lng));
    for (const pin of valid) {
      const marker = L.circleMarker([pin.lat, pin.lng], {
        radius: 10,
        color: "#2563eb",
        fillColor: "#2563eb",
        fillOpacity: 0.9,
      })
        .bindPopup(`<strong>${pin.label}</strong>${pin.extra ? `<br/>${pin.extra}` : ""}`)
        .addTo(map);
      marks.current.push(marker);
    }
    if (valid.length === 1) map.setView([valid[0].lat, valid[0].lng], 15);
    else if (valid.length > 1) {
      map.fitBounds(
        L.latLngBounds(valid.map((pin) => [pin.lat, pin.lng])),
        { padding: [36, 36] },
      );
    } else {
      map.setView([28.6139, 77.209], 11);
    }
    const timer = window.setTimeout(() => map.invalidateSize(), 80);
    return () => window.clearTimeout(timer);
  }, [key]);

  return <div ref={el} className="map" style={{ height }} />;
}
