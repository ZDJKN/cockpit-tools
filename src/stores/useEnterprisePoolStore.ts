import { create } from 'zustand';

import {
  EnterprisePoolApiError,
  createEnterprisePoolClient,
} from '../services/enterprisePoolService';
import type {
  EnterprisePoolAccount,
  EnterprisePoolLoginInput,
  EnterprisePoolSnapshot,
} from '../types/enterprisePool';

const IDENTITY_STORAGE_KEY = 'cockpit.enterprise_pool.identity.v1';
const client = createEnterprisePoolClient();

export type EnterpriseDeviceState =
  | { kind: 'signed_out' }
  | { kind: 'ready' }
  | { kind: 'leased'; account: EnterprisePoolAccount }
  | { kind: 'queued'; position: number }
  | { kind: 'switch_pending'; account: EnterprisePoolAccount };

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

function readStoredIdentity(): EnterprisePoolLoginInput | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const value = JSON.parse(localStorage.getItem(IDENTITY_STORAGE_KEY) ?? 'null') as unknown;
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Partial<EnterprisePoolLoginInput>;
    if (!candidate.userId || !candidate.deviceId || !candidate.displayName) return null;
    return {
      userId: candidate.userId,
      deviceId: candidate.deviceId,
      displayName: candidate.displayName,
    };
  } catch {
    return null;
  }
}

function formatPoolError(error: unknown): string {
  if (error instanceof EnterprisePoolApiError) return `账号池请求失败：${error.code}`;
  if (error instanceof Error) return error.message;
  return '无法连接企业账号池';
}

interface EnterprisePoolStore {
  identity: EnterprisePoolLoginInput | null;
  snapshot: EnterprisePoolSnapshot | null;
  connected: boolean;
  busy: boolean;
  error: string | null;
  refresh(): Promise<void>;
  login(input: EnterprisePoolLoginInput): Promise<void>;
  requestLease(): Promise<void>;
  releaseLease(): Promise<void>;
  updateQuota(accountId: string, hourlyRemaining: number, weeklyRemaining: number): Promise<void>;
  confirmSwitch(): Promise<void>;
  cancelSwitch(): Promise<void>;
  clearIdentity(): Promise<void>;
}

export const useEnterprisePoolStore = create<EnterprisePoolStore>((set, get) => ({
  identity: readStoredIdentity(),
  snapshot: null,
  connected: false,
  busy: false,
  error: null,

  refresh: async () => {
    try {
      const [health, snapshot] = await Promise.all([client.getHealth(), client.getPool()]);
      set({ connected: health.ok, snapshot, error: null });
    } catch (error) {
      set({ connected: false, error: formatPoolError(error) });
    }
  },

  login: async (input) => {
    set({ busy: true, error: null });
    try {
      await client.mockLogin(input);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(input));
      }
      set({ identity: input });
      await get().refresh();
    } catch (error) {
      set({ error: formatPoolError(error) });
    } finally {
      set({ busy: false });
    }
  },

  requestLease: async () => {
    const identity = get().identity;
    if (!identity) return set({ error: '请先完成模拟钉钉登录' });
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

  clearIdentity: async () => {
    const identity = get().identity;
    if (!identity) return;
    set({ busy: true, error: null });
    try {
      // The backend treats release as either lease release or queue cancellation,
      // preventing abandoned identities from receiving an account later.
      await client.releaseLease(identity.deviceId);
      if (typeof localStorage !== 'undefined') localStorage.removeItem(IDENTITY_STORAGE_KEY);
      set({ identity: null });
      await get().refresh();
    } catch (error) {
      set({ error: formatPoolError(error) });
    } finally {
      set({ busy: false });
    }
  },
}));
