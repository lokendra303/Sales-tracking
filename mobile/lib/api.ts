import { persistGet, persistSet } from "./persist";
import { getItem, removeItem, setItem } from "./storage";
import { Platform } from "react-native";

function defaultBase() {
  return process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, "") || "";
}

export const API_BASE = defaultBase();

export type ApiUser = {
  id: number;
  name: string;
  phone: string;
  roles: string[];
  tenant: { id: number; name: string; slug: string };
  liveLocationEnabled: boolean;
  currency: string;
  timezone: string;
};

export type Lead = {
  id: number;
  kind: "lead";
  name: string;
  phone: string;
  contactPerson: string | null;
  businessType: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  source: string;
  status: string;
  approvalStatus?: string;
  rejectionNote?: string | null;
  createdByName?: string | null;
  temperature: string;
  potential: number | null;
  assigneeId: number | null;
  assigneeName: string | null;
  customerId: number | null;
  createdAt: string;
  nextFollowUp: { id: number; type: string; dueAt: string; notes: string | null } | null;
  lastVisit?: { id: number; status: string; outcome: string | null; checkedInAt: string } | null;
  followUps?: FollowUp[];
  customer?: { id: number; name: string; phone: string } | null;
};

export type Customer = {
  id: number;
  kind: "customer";
  name: string;
  phone: string;
  contactPerson: string | null;
  address: string | null;
  city: string | null;
  ownerName: string | null;
};

export type FollowUp = {
  id: number;
  type: string;
  dueAt: string;
  doneAt: string | null;
  notes: string | null;
  name: string;
  phone: string | null;
  leadId: number | null;
  customerId: number | null;
  overdue: boolean;
};

export type Visit = {
  id: number;
  status: "IN_PROGRESS" | "COMPLETED";
  outcome: "SUCCESS" | "UNAVAILABLE" | null;
  notes: string | null;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  placeLat: number | null;
  placeLng: number | null;
  leadId: number | null;
  customerId: number | null;
  beatStopId: number | null;
  userName: string | null;
  checkedInAt: string;
  checkedOutAt: string | null;
  checkinLat: number | null;
  checkinLng: number | null;
  checkinAccuracy: number | null;
  checkinDistanceMeters?: number | null;
  checkoutLat?: number | null;
  checkoutLng?: number | null;
  checkoutAccuracy?: number | null;
  finishDistanceMeters?: number | null;
  distanceMeters: number | null;
  verified: boolean;
  hasPhoto: boolean;
  photoLat: number | null;
  photoLng: number | null;
  photoAccuracy?: number | null;
  photoCapturedAt: string | null;
  photoReceivedAt: string | null;
  managerConfirmedAt?: string | null;
  saleAmount?: number | null;
  collectionAmount?: number | null;
  saleId?: number | null;
  saleHasBill?: boolean;
};

export type Sale = {
  id: number;
  amount: number;
  collectionAmount: number | null;
  note: string | null;
  hasBillPhoto: boolean;
  clientRequestId: string;
  createdAt: string;
  visitId: number | null;
  leadId: number | null;
  customerId: number | null;
  userName: string | null;
  name: string;
  phone: string | null;
};

export type BeatStop = {
  id: number | null;
  sequence: number;
  leadId: number | null;
  customerId: number | null;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  placeLat: number | null;
  placeLng: number | null;
  visitId: number | null;
  visitStatus: string | null;
  visitOutcome: string | null;
  visitAt?: string | null;
  visitedToday?: boolean;
  saleAmount?: number | null;
  saleId?: number | null;
};

export type BeatToday = {
  radiusMeters: number;
  completedToday: number;
  activeVisit: Visit | null;
  stops: BeatStop[];
};

export type BeatPlan = {
  date: string;
  userId: number;
  userName: string;
  planned: boolean;
  stops: BeatStop[];
};

export type FieldSession = {
  id: number | null;
  status: "IDLE" | "ACTIVE" | "ENDED";
  startedAt: string | null;
  endedAt: string | null;
  endedReason: "USER" | "ADMIN_OFF" | "AUTO_CLOSE" | null;
  liveLocationEnabled: boolean;
  liveStreaming: boolean;
  lastLat: number | null;
  lastLng: number | null;
  lastAccuracy: number | null;
  lastSeenAt: string | null;
  lastSeenAgeSeconds: number | null;
  pointCount: number;
  intervalSeconds: number;
  autoCloseHours: number;
  durationMinutes: number;
  autoClosed?: boolean;
};

export type DaySummary = {
  title: string;
  visits: number;
  successVisits: number;
  unavailableVisits: number;
  salesCount: number;
  salesAmount: number;
  missedStops: number;
  missed: { name: string; phone: string | null }[];
  overdueFollowUps: number;
  monthTarget: number;
  monthSalesAmount: number;
  targetPercent: number;
};

export type ReportSummary = {
  year: number;
  month: number;
  todayVisits: number;
  successVisits: number;
  unavailableVisits: number;
  missedStops: number;
  missed: { name: string; phone: string | null }[];
  overdueFollowUps: number;
  todaySalesCount: number;
  todaySalesAmount: number;
  monthSalesCount: number;
  monthSalesAmount: number;
  monthTarget: number;
  targetPercent: number;
};

export type Funnel = {
  days: number;
  leads: number;
  visited: number;
  sold: number;
  leadToVisitPercent: number;
  visitToSalePercent: number;
  salesAmount: number;
};

export type FieldTeammate = {
  userId: number;
  name: string;
  phone: string;
  fieldStatus: string;
  startedAt: string | null;
  lastSeenAt: string | null;
  lastSeenAgeSeconds: number | null;
  liveStreaming: boolean;
  lastLat: number | null;
  lastLng: number | null;
  durationMinutes: number;
};

export type CheckPreview = {
  doneTodayVisitId?: number | null;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  placeLat: number | null;
  placeLng: number | null;
  leadId: number | null;
  customerId: number | null;
  beatStopId: number | null;
  distanceMeters: number | null;
  radiusMeters: number;
  withinRadius: boolean;
  hasPin: boolean;
  allowUnverified: boolean;
};

export class ApiError extends Error {
  code: string;
  extra?: unknown;
  constructor(code: string, message: string, extra?: unknown) {
    super(message);
    this.code = code;
    this.extra = extra;
  }
}

export class OfflineError extends Error {
  constructor(message = "No internet. Saved on this phone.") {
    super(message);
    this.name = "OfflineError";
  }
}

export function isOfflineError(err: unknown) {
  if (err instanceof OfflineError) return true;
  if (err instanceof TypeError) return true;
  const message = err instanceof Error ? err.message : "";
  return /network|failed to fetch|timeout|aborted|network request failed|offline/i.test(message);
}

async function fetchJson(path: string, init: RequestInit, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${API_BASE}${path}`, { ...init, signal: controller.signal });
  } catch {
    throw new OfflineError("No internet. Work stays on this phone until Wi-Fi is back.");
  } finally {
    clearTimeout(timer);
  }
}

export async function serverReachable() {
  if (!API_BASE) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${API_BASE}/health`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; extra?: unknown } };

const tokenListeners = new Set<(access: string | null) => void>();
let refreshInFlight: Promise<{ access: string | null; unreachable: boolean }> | null = null;

export function onAccessTokenChange(fn: (access: string | null) => void) {
  tokenListeners.add(fn);
  return () => {
    tokenListeners.delete(fn);
  };
}

function isAuthLost(code?: string, message?: string) {
  return code === "UNAUTHORIZED" || /please log in again|session expired/i.test(message ?? "");
}

function skipRefresh(path: string) {
  return path.startsWith("/auth/login") || path.startsWith("/auth/refresh") || path.startsWith("/auth/register") || path.startsWith("/auth/logout");
}

async function readJson<T>(response: Response): Promise<ApiResponse<T>> {
  try {
    return (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError("SERVER_ERROR", "The server did not respond. Try again.");
  }
}

export function isSessionRejected(err: unknown) {
  return err instanceof ApiError && isAuthLost(err.code, err.message);
}

async function refreshAccessToken(): Promise<{ access: string | null; unreachable: boolean }> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refreshToken = await getItem("refreshToken");
    if (!refreshToken) return { access: null, unreachable: false };
    try {
      const response = await fetchJson("/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      const json = await readJson<{ accessToken: string; refreshToken: string }>(response);
      if (!json.success) return { access: null, unreachable: false };
      await setItem("accessToken", json.data.accessToken);
      await setItem("refreshToken", json.data.refreshToken);
      tokenListeners.forEach((fn) => fn(json.data.accessToken));
      return { access: json.data.accessToken, unreachable: false };
    } catch (err) {
      return { access: null, unreachable: isOfflineError(err) };
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function clearSession() {
  await removeItem("accessToken");
  await removeItem("refreshToken");
  tokenListeners.forEach((fn) => fn(null));
}

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string | null; retried?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const token = options.token ?? (await getItem("accessToken"));
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const method = (options.method ?? "GET").toUpperCase();
  try {
    const response = await fetchJson(path, { ...options, headers });
    const json = await readJson<T>(response);
    if (!json.success) {
      if (!options.retried && !skipRefresh(path) && isAuthLost(json.error.code, json.error.message)) {
        const next = await refreshAccessToken();
        if (next.access) {
          const { retried: _retried, ...rest } = options;
          return api<T>(path, { ...rest, token: next.access, retried: true });
        }
        if (!next.unreachable) await clearSession();
      }
      throw new ApiError(json.error.code, json.error.message, json.error.extra);
    }
    if (method === "GET") {
      await persistSet(`cache:${path}`, JSON.stringify(json.data));
    }
    return json.data;
  } catch (err) {
    if (method === "GET" && isOfflineError(err)) {
      const cached = await persistGet(`cache:${path}`);
      if (cached) return JSON.parse(cached) as T;
    }
    throw err;
  }
}

async function photoPart(fileUri: string) {
  if (fileUri.startsWith("blob:") || fileUri.startsWith("data:")) {
    const blob = await (await fetch(fileUri)).blob();
    return blob;
  }
  return {
    uri: fileUri,
    name: "place.jpg",
    type: "image/jpeg",
  } as unknown as Blob;
}

export async function apiUpload<T>(
  path: string,
  options: { token?: string | null; fileUri: string; fields?: Record<string, string | number | undefined> },
): Promise<T> {
  const parameters: Record<string, string> = {};
  for (const [key, value] of Object.entries(options.fields ?? {})) {
    if (value != null) parameters[key] = String(value);
  }
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const nativeFile = Platform.OS !== "web" && !options.fileUri.startsWith("blob:") && !options.fileUri.startsWith("data:");
  if (nativeFile) {
    let result;
    try {
      const fs = await import("expo-file-system");
      result = await new fs.File(options.fileUri).upload(`${API_BASE}${path}`, {
        httpMethod: "POST",
        uploadType: fs.UploadType.MULTIPART,
        fieldName: "photo",
        mimeType: "image/jpeg",
        headers,
        parameters,
      });
    } catch {
      throw new OfflineError("No internet. Work stays on this phone until Wi-Fi is back.");
    }
    return readUpload<T>(result.status, result.body);
  }

  const form = new FormData();
  for (const [key, value] of Object.entries(parameters)) form.append(key, value);
  const part = await photoPart(options.fileUri);
  if (part instanceof Blob) form.append("photo", part, "place.jpg");
  else form.append("photo", part);

  const response = await fetchJson(path, { method: "POST", headers, body: form }, 90000);
  const json = (await response.json()) as ApiResponse<T>;
  if (!json.success) throw new ApiError(json.error.code, json.error.message, json.error.extra);
  return json.data;
}

function readUpload<T>(status: number, body: string): T {
  try {
    const json = JSON.parse(body) as ApiResponse<T>;
    if (!json.success) throw new ApiError(json.error.code, json.error.message, json.error.extra);
    return json.data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (status === 413) throw new ApiError("TOO_LARGE", "The photo is too large. Take it again.");
    throw new ApiError("SERVER_ERROR", "The server did not accept the photo. Try again.");
  }
}

async function downloadPhoto(path: string, name: string, token: string, fresh: boolean) {
  const fs = await import("expo-file-system");
  const dir = new fs.Directory(fs.Paths.cache, "server-photos");
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const dest = new fs.File(dir, `${name.replace(/[^0-9a-z-]/gi, "")}.jpg`);
  if (dest.exists && fresh) dest.delete();
  else if (dest.exists && dest.size > 0) return dest.uri;
  const file = await fs.File.downloadFileAsync(`${API_BASE}${path}`, dest, {
    headers: { Authorization: `Bearer ${token}` },
    idempotent: true,
  });
  return file.uri;
}

/** Local file URI for a server photo; the image view itself cannot send the login header reliably. */
async function loadPhoto(path: string, name: string, token: string, fresh: boolean) {
  if (Platform.OS === "web") return fetchPhoto(path, token);
  try {
    return await downloadPhoto(path, name, token, fresh);
  } catch {
    const next = await refreshAccessToken();
    if (!next.access) return null;
    try {
      return await downloadPhoto(path, name, next.access, true);
    } catch {
      return null;
    }
  }
}

export function loadVisitPhoto(visitId: number, token: string, version?: string | null, fresh = false) {
  return loadPhoto(`/visits/${visitId}/photo`, `visit-${visitId}-${version || "0"}`, token, fresh);
}

export function loadBillPhoto(saleId: number, token: string, fresh = false) {
  return loadPhoto(`/sales/${saleId}/bill`, `bill-${saleId}`, token, fresh);
}

async function fetchPhoto(path: string, token: string) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const blob = await response.blob();
  if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    return URL.createObjectURL(blob);
  }
  return null;
}
