import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type ApiUser } from "./api";

type AuthState = {
  user: ApiUser | null;
  accessToken: string | null;
  ready: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");
    (async () => {
      try {
        if (refreshToken) {
          const data = await api<{ user: ApiUser; accessToken: string; refreshToken: string }>("/auth/refresh", {
            method: "POST",
            body: JSON.stringify({ refreshToken }),
          });
          setUser(data.user);
          setAccessToken(data.accessToken);
          localStorage.setItem("accessToken", data.accessToken);
          localStorage.setItem("refreshToken", data.refreshToken);
        } else if (token) {
          setUser(await api<ApiUser>("/auth/me", { token }));
          setAccessToken(token);
        }
      } catch {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      accessToken,
      ready,
      login: async (phone, password) => {
        const data = await api<{ user: ApiUser; accessToken: string; refreshToken: string }>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ phone, password, device: { deviceUid: "salestrack-web", platform: "web" } }),
        });
        setUser(data.user);
        setAccessToken(data.accessToken);
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
      },
      logout: async () => {
        const refreshToken = localStorage.getItem("refreshToken");
        try {
          await api("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) });
        } catch {
          // ignore
        }
        setUser(null);
        setAccessToken(null);
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
      },
      refreshUser: async () => {
        if (!accessToken) return;
        setUser(await api<ApiUser>("/auth/me", { token: accessToken }));
      },
    }),
    [user, accessToken, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
