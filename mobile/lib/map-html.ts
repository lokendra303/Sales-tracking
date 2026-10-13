import { API_BASE } from "@/lib/api";

export type MapMessage =
  | { type: "ready"; lat: number; lng: number; zoom: number }
  | { type: "move"; lat: number; lng: number; zoom: number }
  | { type: "movestart" }
  | { type: "error" }
  | { type: "tileerror" };

export const INDIA = { lat: 22.9734, lng: 78.6569, zoom: 5 };

// OpenStreetMap refuses tile requests that carry no Referer, so the page is served "from" our API domain.
export const MAP_BASE_URL = `${API_BASE.match(/^https?:\/\/[^/]+/)?.[0] ?? "https://salestrack.app"}/`;

export function parseMapMessage(raw: unknown): MapMessage | null {
  if (typeof raw !== "string") return null;
  try {
    const data = JSON.parse(raw) as MapMessage;
    return data && typeof data.type === "string" ? data : null;
  } catch {
    return null;
  }
}

export function pickerHtml(center: { lat: number; lng: number; zoom: number }) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #E5E7EB; }
  .leaflet-control-attribution { font-size: 10px; }
  #pin { position: absolute; left: 50%; top: 50%; width: 40px; height: 52px; margin-left: -20px; margin-top: -51px;
    z-index: 1000; pointer-events: none; transition: transform 0.15s ease; }
  body.moving #pin { transform: translateY(-10px); }
  #shadow { position: absolute; left: 50%; top: 50%; width: 14px; height: 6px; margin-left: -7px; margin-top: -3px;
    border-radius: 50%; background: rgba(15, 23, 42, 0.3); z-index: 999; pointer-events: none; }
</style>
</head>
<body>
<div id="map"></div>
<div id="shadow"></div>
<svg id="pin" viewBox="0 0 40 52" xmlns="http://www.w3.org/2000/svg">
  <path d="M20 50 C17 43 2 32 2 19 A18 18 0 1 1 38 19 C38 32 23 43 20 50 Z" fill="#16A34A" stroke="#ffffff" stroke-width="3" />
  <circle cx="20" cy="19" r="7" fill="#ffffff" />
</svg>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  function send(message) {
    var text = JSON.stringify(message);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(text);
    else if (window.parent && window.parent !== window) window.parent.postMessage(text, "*");
  }
  if (!window.L) {
    send({ type: "error" });
  } else {
    var map = L.map("map", { zoomControl: false }).setView([${center.lat}, ${center.lng}], ${center.zoom});
    map.attributionControl.setPrefix(false);
    var tileFailed = false;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "\u00a9 OpenStreetMap contributors"
    }).on("tileerror", function () {
      if (tileFailed) return;
      tileFailed = true;
      send({ type: "tileerror" });
    }).addTo(map);
    L.control.zoom({ position: "topright" }).addTo(map);
    function emit(type) {
      var c = map.getCenter();
      send({ type: type, lat: c.lat, lng: c.lng, zoom: map.getZoom() });
    }
    map.on("movestart", function () { document.body.className = "moving"; send({ type: "movestart" }); });
    map.on("moveend", function () { document.body.className = ""; emit("move"); });
    window.setCenter = function (lat, lng, zoom) { map.setView([lat, lng], zoom || map.getZoom(), { animate: true }); };
    emit("ready");
  }
</script>
</body>
</html>`;
}
