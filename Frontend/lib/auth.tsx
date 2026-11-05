"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, ApiError } from "./api";
import type { Me } from "./types";

interface AuthState {
  user: Me | null;
  loading: boolean;
  refresh: () => Promise<Me | null>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState>({ user: null, loading: true, refresh: async () => null, signOut: async () => {} });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await apiGet<Me>("/api/v1/me");
      setUser(me);
      return me;
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) setUser(null);
      else setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const signOut = useCallback(async () => {
    try { await apiPost("/api/auth/sign-out", {}); } catch { /* session may already be gone */ }
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, loading, refresh, signOut }}>{children}</Ctx.Provider>;
}

export const roleHome = (role?: string) =>
  role === "admin" ? "/admin" : role === "teacher" ? "/teacher" : "/student";

/**
 * Guard for guest-only pages (sign-in / sign-up): a signed-in user cannot
 * stay on them — they are sent back to their workspace (or role selection)
 * and can only see those pages again after signing out. Pages should keep
 * rendering a loading state while `loading || user`, so the form never
 * flashes before the redirect runs.
 */
export function useRedirectIfSignedIn(returnTo?: string | null) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;
    const needsRole = !user.roleSelected && user.role !== "admin";
    const home = roleHome(user.role);
    // A returnTo pointing back at an auth page would loop — ignore it.
    const dest = needsRole
      ? "/select-role"
      : returnTo && !/^\/(sign-in|sign-up)(\/|$|\?)/.test(returnTo) ? returnTo : home;
    router.replace(dest);
  }, [loading, user, router, returnTo]);

  return { user, loading };
}
