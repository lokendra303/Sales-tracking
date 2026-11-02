function apiBase() {
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "";
  if (!fromEnv) throw new Error("Set VITE_API_URL in frontend/.env");
  if (typeof window === "undefined") return fromEnv;
  const pageHost = window.location.hostname;
  if (!pageHost || pageHost === "localhost" || pageHost === "127.0.0.1") return fromEnv;
  try {
    const api = new URL(fromEnv);
    const apiIsLocal = api.hostname === "localhost" || api.hostname === "127.0.0.1";
    if (!apiIsLocal) return fromEnv;
    const port = api.port ? `:${api.port}` : "";
    const path = api.pathname.replace(/\/$/, "");
    return `${api.protocol}//${pageHost}${port}${path}`;
  } catch {
    return fromEnv;
  }
}

export const API_BASE = apiBase();

export type ApiUser = {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  employeeId?: string | null;
  designation?: string | null;
  city?: string | null;
  address?: string | null;
  joiningDate?: string | null;
  roles: string[];
  /** Main company manager (registered with email). Can deactivate other desk logins. */
  isOwner?: boolean;
  tenant: { id: number; name: string; slug: string };
  liveLocationEnabled: boolean;
  currency: string;
  timezone: string;
  platformAdmin?: boolean;
};

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

type Envelope<T> = { success: true; data: T } | { success: false; error: { code: string; message: string } };

const tokenListeners = new Set<(access: string | null) => void>();
let refreshInFlight: Promise<string | null> | null = null;

export function onAccessTokenChange(fn: (access: string | null) => void) {
  tokenListeners.add(fn);
  return () => tokenListeners.delete(fn);
}

function skipRefresh(path: string) {
  return path.startsWith("/auth/login") || path.startsWith("/auth/refresh") || path.startsWith("/auth/register") || path.startsWith("/auth/logout");
}

/** Renew the short login without asking the person to sign in again. */
export function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return null;
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    const json = (await response.json()) as Envelope<{ accessToken: string; refreshToken: string }>;
    if (!json.success) {
      if (localStorage.getItem("refreshToken") === refreshToken) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        tokenListeners.forEach((fn) => fn(null));
      }
      return null;
    }
    localStorage.setItem("accessToken", json.data.accessToken);
    localStorage.setItem("refreshToken", json.data.refreshToken);
    tokenListeners.forEach((fn) => fn(json.data.accessToken));
    return json.data.accessToken;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function authorizedFetch(path: string, options: RequestInit & { token?: string | null; retried?: boolean } = {}) {
  const headers = new Headers(options.headers);
  const token = options.token ?? localStorage.getItem("accessToken");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (response.status === 401 && !options.retried && !skipRefresh(path)) {
    const next = await refreshAccessToken();
    if (next) return authorizedFetch(path, { ...options, token: next, retried: true });
  }
  return response;
}

export async function api<T>(path: string, options: RequestInit & { token?: string | null; retried?: boolean } = {}) {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) headers.set("Content-Type", "application/json");
  const response = await authorizedFetch(path, { ...options, headers });
  const json = (await response.json()) as Envelope<T>;
  if (!json.success) throw new ApiError(json.error.code, json.error.message);
  return json.data;
}

export async function apiForm<T>(path: string, options: { token?: string | null; form: FormData }) {
  const response = await authorizedFetch(path, { method: "POST", token: options.token, body: options.form });
  const json = (await response.json()) as Envelope<T>;
  if (!json.success) throw new ApiError(json.error.code, json.error.message);
  return json.data;
}

export async function apiBlob(path: string, token: string) {
  const response = await authorizedFetch(path, { token });
  if (!response.ok) throw new ApiError("NOT_FOUND", "Could not load the file.");
  return URL.createObjectURL(await response.blob());
}
