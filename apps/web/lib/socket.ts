'use client';
import type { ClientMessage, NotificationDTO, ServerMessage } from '@launch/types';
import { create } from 'zustand';
import { WS_URL } from './config';
import { useAuth } from './auth-store';
import { toast } from '@/components/ui/toast';

type Listener = (msg: ServerMessage) => void;

interface SocketState {
  status: 'idle' | 'connecting' | 'open' | 'authed' | 'closed';
  notifications: NotificationDTO[];
  unread: number;
  connect: () => void;
  disconnect: () => void;
  send: (msg: ClientMessage) => boolean;
  subscribe: (fn: Listener) => () => void;
  setNotifications: (n: NotificationDTO[], unread: number) => void;
}

let ws: WebSocket | null = null;
let listeners = new Set<Listener>();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;

export const useSocket = create<SocketState>((set, get) => ({
  status: 'idle',
  notifications: [],
  unread: 0,
  connect: () => {
    const token = useAuth.getState().accessToken;
    if (!token || (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING))) return;
    set({ status: 'connecting' });
    const socket = new WebSocket(WS_URL);
    ws = socket;
    socket.onopen = () => {
      set({ status: 'open' });
      socket.send(JSON.stringify({ type: 'auth', token: useAuth.getState().accessToken }));
      pingTimer = setInterval(() => socket.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ type: 'ping' })), 25_000);
    };
    socket.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data as string) as ServerMessage;
      } catch {
        return;
      }
      if (msg.type === 'auth:ok') set({ status: 'authed' });
      if (msg.type === 'auth:error') toast.error('Realtime connection', msg.message);
      if (msg.type === 'notification') {
        set((s) => ({ notifications: [msg.notification, ...s.notifications].slice(0, 50), unread: s.unread + 1 }));
        toast.info(msg.notification.title, msg.notification.body);
      }
      for (const l of listeners) l(msg);
    };
    socket.onclose = () => {
      set({ status: 'closed' });
      if (pingTimer) clearInterval(pingTimer);
      ws = null;
      if (useAuth.getState().accessToken) reconnectTimer = setTimeout(() => get().connect(), 3000);
    };
    socket.onerror = () => socket.close();
  },
  disconnect: () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    ws?.close();
    ws = null;
    set({ status: 'idle' });
  },
  send: (msg) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(msg));
    return true;
  },
  subscribe: (fn) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  setNotifications: (notifications, unread) => set({ notifications, unread }),
}));
