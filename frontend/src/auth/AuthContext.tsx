import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, getMe, getAuthToken, setAuthToken, AUTH_EXPIRED_EVENT } from "@/services/api";
import type { AuthUser } from "@/services/api";

type AuthState = {
  token: string;
  user: AuthUser | null;
  loading: boolean;
  online: boolean;
  authError: string | null;
};

type AuthContextValue = AuthState & {
  setSession: (token: string, user: AuthUser) => void;
  refresh: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string>(() => getAuthToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [online, setOnline] = useState<boolean>(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [authError, setAuthError] = useState<string | null>(null);

  const logout = useCallback(() => {
    setAuthToken("");
    setToken("");
    setUser(null);
    setLoading(false);
    setAuthError(null);
  }, []);

  const refresh = useCallback(async () => {
    const t = getAuthToken();
    setToken(t);
    setAuthError(null);
    if (!t) {
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await getMe();
      setUser(res.user);
    } catch (err) {
      if (err instanceof ApiError && err.isNetworkError) {
        setAuthError("NETWORK");
      } else {
        setAuthToken("");
        setToken("");
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const setSession = useCallback((newToken: string, newUser: AuthUser) => {
    setAuthToken(newToken);
    setToken(newToken);
    setUser(newUser);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    const onExpired = () => logout();
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired as EventListener);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired as EventListener);
  }, [logout]);

  const value = useMemo<AuthContextValue>(
    () => ({ token, user, loading, online, authError, setSession, refresh, logout }),
    [token, user, loading, online, authError, setSession, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
