'use client';
import type { AuthUser, WalletDTO } from '@launch/types';
import { create } from 'zustand';
import { api, bindTokenStore, refreshAccessToken } from './api';

interface AuthState {
  user: AuthUser | null;
  wallets: WalletDTO[];
  accessToken: string | null;
  ready: boolean;
  setSession: (s: { user: AuthUser; accessToken: string; refreshToken?: string }) => void;
  loadMe: () => Promise<void>;
  bootstrap: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  wallets: [],
  accessToken: null,
  ready: false,
  setSession: ({ user, accessToken, refreshToken }) => {
    if (refreshToken && typeof localStorage !== 'undefined') localStorage.setItem('launch_refresh', refreshToken);
    set({ user, accessToken, ready: true });
    void get().loadMe();
  },
  loadMe: async () => {
    try {
      const me = await api<{ user: AuthUser; wallets: WalletDTO[] }>('/auth/me');
      set({ user: me.user, wallets: me.wallets });
    } catch {
      set({ user: null, wallets: [], accessToken: null });
    }
  },
  bootstrap: async () => {
    const token = await refreshAccessToken();
    if (token) {
      set({ accessToken: token });
      await get().loadMe();
    }
    set({ ready: true });
  },
  logout: async () => {
    await api('/auth/logout', { method: 'POST', json: { refreshToken: typeof localStorage !== 'undefined' ? localStorage.getItem('launch_refresh') : undefined } }).catch(() => undefined);
    if (typeof localStorage !== 'undefined') localStorage.removeItem('launch_refresh');
    set({ user: null, wallets: [], accessToken: null });
  },
}));

bindTokenStore({ get: () => useAuth.getState().accessToken, set: (t) => useAuth.setState({ accessToken: t }) });
