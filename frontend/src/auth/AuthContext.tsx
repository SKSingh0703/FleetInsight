import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getMe, getAuthToken, setAuthToken } from "@/services/api";
import type { AuthUser } from "@/services/api";

type AuthState = {
  token: string;
  user: AuthUser | null;
  loading: boolean;
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

  const logout = useCallback(() => {
    setAuthToken("");
    setToken("");
    setUser(null);
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    const t = getAuthToken();
    setToken(t);
    if (!t) {
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await getMe();
      setUser(res.user);
    } catch {
      // token invalid/expired
      setAuthToken("");
      setToken("");
      setUser(null);
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

  const value = useMemo<AuthContextValue>(
    () => ({ token, user, loading, setSession, refresh, logout }),
    [token, user, loading, setSession, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
