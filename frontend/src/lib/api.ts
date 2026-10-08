function apiBase() {
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:3000";
  if (typeof window === "undefined") return fromEnv;
  const pageHost = window.location.hostname;
  if (!pageHost || pageHost === "localhost" || pageHost === "127.0.0.1") return fromEnv;
  try {
    const api = new URL(fromEnv);
    const apiIsLocal = api.hostname === "localhost" || api.hostname === "127.0.0.1";
    if (!apiIsLocal) return fromEnv;
    const port = api.port ? `:${api.port}` : "";
    return `${api.protocol}//${pageHost}${port}`;
  } catch {
    return fromEnv;
  }
}

export const API_BASE = apiBase();

export type ApiUser = {
  id: number;
  name: string;
  phone: string;
  roles: string[];
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

export async function api<T>(path: string, options: RequestInit & { token?: string | null } = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const json = (await response.json()) as Envelope<T>;
  if (!json.success) throw new ApiError(json.error.code, json.error.message);
  return json.data;
}

export async function apiForm<T>(path: string, options: { token?: string | null; form: FormData }) {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const response = await fetch(`${API_BASE}${path}`, { method: "POST", headers, body: options.form });
  const json = (await response.json()) as Envelope<T>;
  if (!json.success) throw new ApiError(json.error.code, json.error.message);
  return json.data;
}

export async function apiBlob(path: string, token: string) {
  const response = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new ApiError("NOT_FOUND", "Could not load the file.");
  return URL.createObjectURL(await response.blob());
}
