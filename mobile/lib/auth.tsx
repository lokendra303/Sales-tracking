import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, isOfflineError, isSessionRejected, onAccessTokenChange, type ApiUser } from "./api";
import { getItem, removeItem, setItem } from "./storage";
import { readCachedUser, writeCachedUser } from "./user-cache";

type AuthState = {
  user: ApiUser | null;
  accessToken: string | null;
  ready: boolean;
  login: (phone: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stop = onAccessTokenChange((token) => {
      setAccessToken(token);
      if (!token) {
        setUser(null);
        writeCachedUser(null);
      }
    });
    return () => {
      stop();
    };
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const remember = await getItem("rememberLogin");
      const token = await getItem("accessToken");
      const refreshToken = await getItem("refreshToken");
      const cached = await readCachedUser();
      if (cancel) return;

      if (remember === "0") {
        await removeItem("accessToken");
        await removeItem("refreshToken");
        await writeCachedUser(null);
        if (!cancel) setReady(true);
        return;
      }

      const saved = Boolean(cached && (token || refreshToken));
      if (saved && cached) {
        setUser(cached);
        setAccessToken(token);
        setReady(true);
      }

      if (!token && !refreshToken) {
        if (!cancel) setReady(true);
        return;
      }

      try {
        if (refreshToken) {
          const data = await api<{ user: ApiUser; accessToken: string; refreshToken: string }>("/auth/refresh", {
            method: "POST",
            body: JSON.stringify({ refreshToken }),
          });
          if (cancel) return;
          setUser(data.user);
          setAccessToken(data.accessToken);
          await writeCachedUser(data.user);
          await setItem("accessToken", data.accessToken);
          await setItem("refreshToken", data.refreshToken);
        } else if (token) {
          const me = await api<ApiUser>("/auth/me", { token });
          if (cancel) return;
          setUser(me);
          setAccessToken(token);
          await writeCachedUser(me);
        }
      } catch (err) {
        if (cancel) return;
        if (saved && !isSessionRejected(err)) return;
        if (isOfflineError(err) && token && cached) {
          setUser(cached);
          setAccessToken(token);
          return;
        }
        setUser(null);
        setAccessToken(null);
        await writeCachedUser(null);
        await removeItem("accessToken");
        await removeItem("refreshToken");
      } finally {
        if (!cancel) setReady(true);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      accessToken,
      ready,
      login: async (phone, password, remember) => {
        const data = await api<{ user: ApiUser; accessToken: string; refreshToken: string }>("/auth/login", {
          method: "POST",
          body: JSON.stringify({
            phone,
            password,
            device: { deviceUid: "salestrack-dev", platform: "android", appVersion: "0.1.0" },
          }),
        });
        setUser(data.user);
        setAccessToken(data.accessToken);
        await writeCachedUser(data.user);
        await setItem("accessToken", data.accessToken);
        await setItem("refreshToken", data.refreshToken);
        await setItem("rememberLogin", remember ? "1" : "0");
      },
      logout: async () => {
        const refreshToken = await getItem("refreshToken");
        try {
          await api("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) });
        } catch {
          // ignore
        }
        setUser(null);
        setAccessToken(null);
        await writeCachedUser(null);
        await removeItem("accessToken");
        await removeItem("refreshToken");
        await removeItem("rememberLogin");
      },
      refreshUser: async () => {
        if (!accessToken) return;
        try {
          const me = await api<ApiUser>("/auth/me", { token: accessToken });
          setUser(me);
          await writeCachedUser(me);
        } catch {
          // ignore
        }
      },
    }),
    [user, accessToken, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
