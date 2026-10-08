"use client";

import { useEffect, useRef, useState } from "react";
import type { GlobalSnapshot } from "@/lib/types";
import { api } from "@/lib/api";

/**
 * Live community counter. Subscribes to the server's WebSocket and falls back
 * to polling if the socket cannot be opened.
 */
export function useGlobal(initial: GlobalSnapshot | null = null) {
  const [global, setGlobal] = useState<GlobalSnapshot | null>(initial);
  const [connected, setConnected] = useState(false);
  const offset = useRef(0); // server clock − client clock

  useEffect(() => {
    let ws: WebSocket | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const apply = (g: GlobalSnapshot) => {
      offset.current = g.serverTime - Date.now();
      setGlobal(g);
    };

    const startPolling = () => {
      if (poll) return;
      const tick = () => api<{ global: GlobalSnapshot }>("/api/global").then((r) => apply(r.global)).catch(() => {});
      tick();
      poll = setInterval(tick, 3000);
    };

    const connect = () => {
      if (closed) return;
      try {
        const proto = location.protocol === "https:" ? "wss" : "ws";
        ws = new WebSocket(`${proto}://${location.host}/ws`);
      } catch {
        startPolling();
        return;
      }
      ws.onopen = () => {
        setConnected(true);
        if (poll) {
          clearInterval(poll);
          poll = null;
        }
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as { type: string; payload: GlobalSnapshot };
          if (msg.type === "global") apply(msg.payload);
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        setConnected(false);
        startPolling();
        retry = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws?.close();
    };

    api<{ global: GlobalSnapshot }>("/api/global").then((r) => apply(r.global)).catch(() => {});
    connect();
    return () => {
      closed = true;
      ws?.close();
      if (poll) clearInterval(poll);
      if (retry) clearTimeout(retry);
    };
  }, []);

  return { global, connected, serverNow: () => Date.now() + offset.current };
}
