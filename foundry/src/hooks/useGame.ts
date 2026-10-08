"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { GameView, GlobalSnapshot, PublicProject } from "@/lib/types";
import { ACHIEVEMENT_BY_ID } from "@/lib/content/achievements";

export interface Toast {
  id: number;
  kind: "achievement" | "error" | "info";
  title: string;
  body?: string;
}

export interface LocalNumbers {
  balance: number;
  totalProduced: number;
  burnPower: number;
  totalClicks: number;
}

const SYNC_MS = 1000;
const IDLE_SYNC_MS = 5000;
const DISPLAY_MS = 66;

/**
 * Client side of the game loop.
 *
 * The server owns the truth; this hook predicts it between syncs so numbers
 * move smoothly, and replaces its prediction with the server's answer on every
 * response. Clicks are counted locally and reported in batches.
 */
export function useGame(enabled: boolean, onAuthLost: () => void) {
  const [server, setServer] = useState<GameView | null>(null);
  const [project, setProject] = useState<PublicProject | null>(null);
  const [initialGlobal, setInitialGlobal] = useState<GlobalSnapshot | null>(null);
  const [local, setLocal] = useState<LocalNumbers>({ balance: 0, totalProduced: 0, burnPower: 0, totalClicks: 0 });
  const [frozen, setFrozen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const serverRef = useRef<GameView | null>(null);
  const localRef = useRef<LocalNumbers>({ balance: 0, totalProduced: 0, burnPower: 0, totalClicks: 0 });
  const pending = useRef(0);
  const inflight = useRef(false);
  const lastSync = useRef(0);
  const toastId = useRef(0);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++toastId.current;
    setToasts((ts) => [...ts.slice(-5), { ...t, id }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), t.kind === "error" ? 5000 : 7000);
  }, []);

  const reconcile = useCallback(
    (view: GameView) => {
      serverRef.current = view;
      setServer(view);
      const extra = pending.current * view.clickPower;
      localRef.current = {
        balance: view.balance + extra,
        totalProduced: view.totalProduced + extra,
        burnPower: view.burnPower + pending.current * view.clickBurn,
        totalClicks: view.totalClicks + pending.current,
      };
      setLocal({ ...localRef.current });
      for (const id of (view as GameView & { newAchievements?: string[] }).newAchievements ?? []) {
        const a = ACHIEVEMENT_BY_ID[id];
        if (a) toast({ kind: "achievement", title: a.name, body: a.description });
      }
    },
    [toast],
  );

  const handleError = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError) {
        if (e.status === 401) return onAuthLost();
        if (e.status === 423) {
          setFrozen(true);
          return;
        }
        if (e.status !== 429) toast({ kind: "error", title: e.message });
        return;
      }
      toast({ kind: "error", title: "Network error" });
    },
    [onAuthLost, toast],
  );

  // initial load
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    api<{ state: GameView; global: GlobalSnapshot; project: PublicProject }>("/api/game/state")
      .then((r) => {
        if (cancelled) return;
        setProject(r.project);
        setInitialGlobal(r.global);
        reconcile(r.state);
        const until = r.project.frozenAt ?? (r.project.status === "ACTIVE" ? r.project.endsAt : null);
        if (!(r.project.status === "DRAFT" || r.project.status === "ACTIVE") || (until && Date.now() >= new Date(until).getTime())) setFrozen(true);
        const gain = (r.state as GameView & { offlineGain?: number }).offlineGain ?? 0;
        if (gain > 1) toast({ kind: "info", title: "Welcome back", body: `Your generators produced ${Math.floor(gain).toLocaleString("en-US")} while you were away.` });
        lastSync.current = Date.now();
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) onAuthLost();
        else setLoadError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, onAuthLost, reconcile, toast]);

  // prediction loop
  useEffect(() => {
    if (!enabled) return;
    let last = performance.now();
    const t = setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      const s = serverRef.current;
      if (!s || frozen) return;
      const l = localRef.current;
      l.balance += s.productionPerSec * dt;
      l.totalProduced += s.productionPerSec * dt;
      l.burnPower += s.burnPerSec * dt;
      setLocal({ ...l });
    }, DISPLAY_MS);
    return () => clearInterval(t);
  }, [enabled, frozen]);

  // sync loop
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(async () => {
      if (!serverRef.current || inflight.current || frozen) return;
      const idle = Date.now() - lastSync.current;
      if (pending.current === 0 && idle < IDLE_SYNC_MS) return;
      const clicks = pending.current;
      pending.current = 0;
      inflight.current = true;
      try {
        const r = await api<{ state: GameView }>("/api/game/sync", { json: { clicks } });
        lastSync.current = Date.now();
        reconcile(r.state);
      } catch (e) {
        if (!(e instanceof ApiError)) pending.current += clicks; // network blip: retry next round
        handleError(e);
      } finally {
        inflight.current = false;
      }
    }, SYNC_MS);
    return () => clearInterval(t);
  }, [enabled, frozen, handleError, reconcile]);

  const click = useCallback(() => {
    const s = serverRef.current;
    if (!s || frozen) return;
    pending.current += 1;
    const l = localRef.current;
    l.balance += s.clickPower;
    l.totalProduced += s.clickPower;
    l.burnPower += s.clickBurn;
    l.totalClicks += 1;
  }, [frozen]);

  const act = useCallback(
    async (path: string, body: unknown) => {
      if (busy) return;
      setBusy(true);
      try {
        const r = await api<{ state: GameView }>(path, { json: body });
        reconcile(r.state);
      } catch (e) {
        handleError(e);
      } finally {
        setBusy(false);
      }
    },
    [busy, handleError, reconcile],
  );

  const buy = useCallback((generatorId: string, qty: number | "max") => act("/api/game/buy", { generatorId, qty }), [act]);
  const levelUp = useCallback((generatorId: string) => act("/api/game/level", { generatorId }), [act]);
  const upgrade = useCallback((upgradeId: string) => act("/api/game/upgrade", { upgradeId }), [act]);
  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);

  return { server, project, initialGlobal, local, frozen, setFrozen, toasts, dismiss, busy, loadError, click, buy, levelUp, upgrade, toast };
}
