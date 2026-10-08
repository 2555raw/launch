"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { PublicUser } from "@/lib/types";

export function useAuth() {
  const [user, setUser] = useState<PublicUser | null | undefined>(undefined);
  const refresh = useCallback(async () => {
    const r = await api<{ user: PublicUser | null }>("/api/auth/me");
    setUser(r.user);
    return r.user;
  }, []);
  useEffect(() => {
    refresh().catch(() => setUser(null));
  }, [refresh]);
  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);
  return { user, setUser, refresh, logout, loading: user === undefined };
}
