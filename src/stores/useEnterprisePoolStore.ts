import { create } from 'zustand';

import {
  EnterprisePoolApiError,
  createEnterprisePoolClient,
} from '../services/enterprisePoolService';
import type {
  EnterpriseAuthMode,
  EnterpriseIdentity,
  EnterprisePoolAccount,
  EnterprisePoolLoginInput,
  EnterprisePoolSnapshot,
} from '../types/enterprisePool';

const DEVICE_STORAGE_KEY = 'cockpit.enterprise_pool.device_id.v1';
const client = createEnterprisePoolClient();

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function createUuid(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    const normalized = character === 'x' ? value : (value & 0x3) | 0x8;
    return normalized.toString(16);
  });
}

export function getOrCreateEnterpriseDeviceId(
  storage: StorageLike | null = typeof localStorage === 'undefined' ? null : localStorage,
): string {
  const existing = storage?.getItem(DEVICE_STORAGE_KEY)?.trim();
  if (existing?.startsWith('windows-')) return existing;
  const created = `windows-${createUuid()}`;
  storage?.setItem(DEVICE_STORAGE_KEY, created);
  return created;
}

export type EnterpriseDeviceState =
  | { kind: 'signed_out' }
  | { kind: 'ready' }
  | { kind: 'leased'; account: EnterprisePoolAccount }
  | { kind: 'queued'; position: number }
  | { kind: 'switch_pending'; account: EnterprisePoolAccount };

export type EnterpriseAuthState =
  | 'loading_mode'
  | 'signed_out'
  | 'opening_browser'
  | 'waiting_for_dingtalk'
  | 'signed_in'
  | 'auth_error';

export interface EnterpriseSignedInIdentity extends EnterpriseIdentity {
  deviceId: string;
  userId: string;
}

interface PendingDesktopLogin {
  transactionId: string;
  verifier: string;
  loginUrl: string;
  expiresAt: number;
  pollAfterMs: number;
}

export function deriveEnterpriseDeviceState(
  snapshot: EnterprisePoolSnapshot,
  deviceId: string | null,
): EnterpriseDeviceState {
  if (!deviceId) return { kind: 'signed_out' };
  const lease = snapshot.leases.find((item) => item.deviceId === deviceId);
  if (lease) {
    const account = snapshot.accounts.find((item) => item.id === lease.accountId);
    if (account) {
      return lease.status === 'switch_pending'
        ? { kind: 'switch_pending', account }
        : { kind: 'leased', account };
    }
  }
  const queueIndex = snapshot.queue.findIndex((item) => item.deviceId === deviceId);
  if (queueIndex >= 0) return { kind: 'queued', position: queueIndex + 1 };
  return { kind: 'ready' };
}

function formatPoolError(error: unknown): string {
  if (error instanceof EnterprisePoolApiError) return `账号池请求失败：${error.code}`;
  if (error instanceof Error) return error.message;
  return '无法连接企业账号池';
}

interface EnterprisePoolStore {
  deviceId: string;
  authMode: EnterpriseAuthMode | null;
  authState: EnterpriseAuthState;
  identity: EnterpriseSignedInIdentity | null;
  pendingLogin: PendingDesktopLogin | null;
  snapshot: EnterprisePoolSnapshot | null;
  connected: boolean;
  busy: boolean;
  error: string | null;
  refresh(): Promise<void>;
  login(input: EnterprisePoolLoginInput): Promise<void>;
  loginMock(input: { userId: string; displayName: string }): Promise<void>;
  startDingTalkLogin(openLogin: (url: string) => Promise<void>): Promise<void>;
  pollDingTalkLogin(): Promise<void>;
  cancelLogin(): void;
  requestLease(): Promise<void>;
  releaseLease(): Promise<void>;
  updateQuota(accountId: string, hourlyRemaining: number, weeklyRemaining: number): Promise<void>;
  confirmSwitch(): Promise<void>;
  cancelSwitch(): Promise<void>;
  logout(): Promise<void>;
  clearIdentity(): Promise<void>;
}

function signedIdentity(identity: EnterpriseIdentity, deviceId: string): EnterpriseSignedInIdentity {
  return { ...identity, deviceId, userId: identity.subject };
}

export const useEnterprisePoolStore = create<EnterprisePoolStore>((set, get) => ({
  deviceId: getOrCreateEnterpriseDeviceId(),
  authMode: null,
  authState: 'signed_out',
  identity: null,
  pendingLogin: null,
  snapshot: null,
  connected: false,
  busy: false,
  error: null,

  refresh: async () => {
    try {
      const [health, snapshot] = await Promise.all([client.getHealth(), client.getPool()]);
      set((state) => ({
        connected: health.ok,
        authMode: health.mode,
        snapshot,
        error: state.authState === 'auth_error' ? state.error : null,
      }));
    } catch (error) {
      set({ connected: false, error: formatPoolError(error) });
    }
  },

  login: async (input) => await get().loginMock({ userId: input.userId, displayName: input.displayName }),

  loginMock: async (input) => {
    set({ busy: true, error: null });
    try {
      const result = await client.desktopMockLogin({ ...input, deviceId: get().deviceId });
      client.setSessionToken(result.sessionToken);
      set({
        authMode: 'mock',
        authState: 'signed_in',
        identity: signedIdentity(result.identity, result.deviceId),
        pendingLogin: null,
      });
      await get().refresh();
    } catch (error) {
      set({ authState: 'auth_error', error: formatPoolError(error) });
    } finally {
      set({ busy: false });
    }
  },

  startDingTalkLogin: async (openLogin) => {
    set({ busy: true, authState: 'opening_browser', error: null });
    try {
      const task = await client.startDesktopLogin(get().deviceId);
      set({ pendingLogin: task });
      await openLogin(task.loginUrl);
      set({ authState: 'waiting_for_dingtalk' });
    } catch (error) {
      set({ authState: 'auth_error', error: formatPoolError(error) });
    } finally {
      set({ busy: false });
    }
  },

  pollDingTalkLogin: async () => {
    const pending = get().pendingLogin;
    if (!pending || get().authState !== 'waiting_for_dingtalk') return;
    if (pending.expiresAt <= Date.now()) {
      return set({
        authState: 'auth_error',
        pendingLogin: null,
        error: '钉钉登录已超时，请重新发起',
      });
    }
    try {
      const result = await client.pollDesktopLogin(pending.transactionId, pending.verifier);
      if (result.status === 'pending') {
        return set({ pendingLogin: { ...pending, pollAfterMs: result.pollAfterMs }, error: null });
      }
      client.setSessionToken(result.sessionToken);
      set({
        authMode: 'dingtalk',
        authState: 'signed_in',
        identity: signedIdentity(result.identity, result.deviceId),
        pendingLogin: null,
        error: null,
      });
      await get().refresh();
    } catch (error) {
      if (error instanceof EnterprisePoolApiError) {
        set({ authState: 'auth_error', pendingLogin: null, error: formatPoolError(error) });
      } else {
        set({
          error: formatPoolError(error),
          pendingLogin: { ...pending, pollAfterMs: Math.min(5_000, pending.pollAfterMs * 2) },
        });
      }
    }
  },

  cancelLogin: () => set({ authState: 'signed_out', pendingLogin: null, error: null }),

  requestLease: async () => {
    const identity = get().identity;
    if (!identity) return set({ error: '请先完成企业身份登录' });
    set({ busy: true, error: null });
    try {
      await client.requestLease(identity.deviceId);
      await get().refresh();
    } catch (error) {
      set({ error: formatPoolError(error) });
    } finally {
      set({ busy: false });
    }
  },

  releaseLease: async () => {
    const identity = get().identity;
    if (!identity) return;
    set({ busy: true, error: null });
    try {
      await client.releaseLease(identity.deviceId);
      await get().refresh();
    } catch (error) {
      set({ error: formatPoolError(error) });
    } finally {
      set({ busy: false });
    }
  },

  updateQuota: async (accountId, hourlyRemaining, weeklyRemaining) => {
    set({ busy: true, error: null });
    try {
      await client.updateQuota(accountId, hourlyRemaining, weeklyRemaining);
      await get().refresh();
    } catch (error) {
      set({ error: formatPoolError(error) });
    } finally {
      set({ busy: false });
    }
  },

  confirmSwitch: async () => {
    const identity = get().identity;
    if (!identity) return;
    set({ busy: true, error: null });
    try {
      await client.confirmSwitch(identity.deviceId);
      await get().refresh();
    } catch (error) {
      set({ error: formatPoolError(error) });
    } finally {
      set({ busy: false });
    }
  },

  cancelSwitch: async () => {
    const identity = get().identity;
    if (!identity) return;
    set({ busy: true, error: null });
    try {
      await client.cancelSwitch(identity.deviceId);
      await get().refresh();
    } catch (error) {
      set({ error: formatPoolError(error) });
    } finally {
      set({ busy: false });
    }
  },

  logout: async () => {
    const identity = get().identity;
    if (!identity) return;
    set({ busy: true, error: null });
    try {
      await client.releaseLease(identity.deviceId);
      await client.logout();
      client.setSessionToken(null);
      set({ identity: null, authState: 'signed_out', pendingLogin: null });
      await get().refresh();
    } catch (error) {
      set({ error: formatPoolError(error) });
    } finally {
      set({ busy: false });
    }
  },

  clearIdentity: async () => await get().logout(),
}));
