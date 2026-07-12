import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  deriveEnterpriseDeviceState,
  getOrCreateEnterpriseDeviceId,
  useEnterprisePoolStore,
} from './useEnterprisePoolStore';
import type { EnterprisePoolSnapshot } from '../types/enterprisePool';

const emptySnapshot: EnterprisePoolSnapshot = {
  accounts: [],
  devices: [],
  leases: [],
  queue: [],
  quotaSnapshots: [],
  audit: [],
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  useEnterprisePoolStore.setState({
    identity: null,
    snapshot: null,
    connected: false,
    busy: false,
    error: null,
    authMode: null,
    authState: 'signed_out',
    pendingLogin: null,
  });
});

describe('enterprise installation identity', () => {
  it('generates and reuses one stable installation device ID', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    const first = getOrCreateEnterpriseDeviceId(storage);
    const second = getOrCreateEnterpriseDeviceId(storage);

    expect(first).toMatch(/^windows-[0-9a-f-]+$/);
    expect(second).toBe(first);
  });
});

describe('deriveEnterpriseDeviceState', () => {
  it('returns signed_out without a local device identity', () => {
    expect(deriveEnterpriseDeviceState(emptySnapshot, null)).toEqual({ kind: 'signed_out' });
  });

  it('returns ready for a registered device without a lease or queue entry', () => {
    const snapshot = {
      ...emptySnapshot,
      devices: [{ id: 'windows-1', userId: 'ding-1', displayName: '用户 1' }],
    };

    expect(deriveEnterpriseDeviceState(snapshot, 'windows-1')).toEqual({ kind: 'ready' });
  });

  it('returns leased with account details', () => {
    const snapshot: EnterprisePoolSnapshot = {
      ...emptySnapshot,
      accounts: [{ id: 'account-1', hourlyRemaining: 70, weeklyRemaining: 60 }],
      leases: [
        {
          id: 'lease-1',
          accountId: 'account-1',
          deviceId: 'windows-1',
          status: 'active',
          createdAt: 1,
        },
      ],
    };

    expect(deriveEnterpriseDeviceState(snapshot, 'windows-1')).toMatchObject({
      kind: 'leased',
      account: { id: 'account-1', hourlyRemaining: 70, weeklyRemaining: 60 },
    });
  });

  it('returns queued with a one-based position', () => {
    const snapshot: EnterprisePoolSnapshot = {
      ...emptySnapshot,
      queue: [
        { deviceId: 'windows-2', queuedAt: 1 },
        { deviceId: 'windows-1', queuedAt: 2 },
      ],
    };

    expect(deriveEnterpriseDeviceState(snapshot, 'windows-1')).toEqual({
      kind: 'queued',
      position: 2,
    });
  });

  it('returns switch_pending for a lease waiting on confirmation', () => {
    const snapshot: EnterprisePoolSnapshot = {
      ...emptySnapshot,
      accounts: [{ id: 'account-1', hourlyRemaining: 9, weeklyRemaining: 60 }],
      leases: [
        {
          id: 'lease-1',
          accountId: 'account-1',
          deviceId: 'windows-1',
          status: 'switch_pending',
          createdAt: 1,
        },
      ],
    };

    expect(deriveEnterpriseDeviceState(snapshot, 'windows-1')).toMatchObject({
      kind: 'switch_pending',
      account: { id: 'account-1' },
    });
  });
});

describe('enterprise pool store actions', () => {
  it('completes Mock desktop login without persisting the user or session token', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/api/auth/desktop/mock/login')) {
        return jsonResponse({
          status: 'completed',
          sessionToken: 'memory-only-token',
          identity: { provider: 'mock', subject: 'mock-1', displayName: '用户 1' },
          deviceId: 'windows-1',
        });
      }
      if (url.endsWith('/api/health')) {
        return jsonResponse({ ok: true, ready: true, mode: 'mock', database: 'postgres' });
      }
      if (url.endsWith('/api/pool')) return jsonResponse(emptySnapshot);
      return jsonResponse({ ok: true });
    });
    vi.stubGlobal('fetch', fetchMock);
    useEnterprisePoolStore.setState({ deviceId: 'windows-1' });

    await useEnterprisePoolStore.getState().loginMock({ userId: 'mock-1', displayName: '用户 1' });

    expect(useEnterprisePoolStore.getState()).toMatchObject({
      authState: 'signed_in',
      identity: {
        provider: 'mock',
        subject: 'mock-1',
        displayName: '用户 1',
        deviceId: 'windows-1',
      },
    });
  });

  it('moves DingTalk login through browser waiting and completed polling', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/api/auth/desktop/start')) {
        return jsonResponse({
          transactionId: 'transaction-1',
          verifier: 'verifier-1',
          loginUrl: 'https://login.example.com',
          expiresAt: Date.now() + 60_000,
          pollAfterMs: 1500,
        });
      }
      if (url.endsWith('/api/auth/desktop/poll')) {
        return jsonResponse({
          status: 'completed',
          sessionToken: 'desktop-session',
          identity: { provider: 'dingtalk', subject: 'union-1', displayName: '钉钉员工' },
          deviceId: 'windows-1',
        });
      }
      if (url.endsWith('/api/health')) {
        return jsonResponse({ ok: true, ready: true, mode: 'dingtalk', database: 'postgres' });
      }
      if (url.endsWith('/api/pool')) return jsonResponse(emptySnapshot);
      return jsonResponse({ ok: true });
    });
    vi.stubGlobal('fetch', fetchMock);
    const openLogin = vi.fn(async () => undefined);
    useEnterprisePoolStore.setState({ deviceId: 'windows-1', authMode: 'dingtalk' });

    await useEnterprisePoolStore.getState().startDingTalkLogin(openLogin);
    expect(openLogin).toHaveBeenCalledWith('https://login.example.com');
    expect(useEnterprisePoolStore.getState().authState).toBe('waiting_for_dingtalk');

    await useEnterprisePoolStore.getState().pollDingTalkLogin();
    expect(useEnterprisePoolStore.getState()).toMatchObject({
      authState: 'signed_in',
      pendingLogin: null,
      identity: { provider: 'dingtalk', subject: 'union-1', deviceId: 'windows-1' },
    });
  });

  it('releases a lease or queue entry before clearing the local identity', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/api/leases/windows-1/release')) return jsonResponse({ ok: true });
      if (url.endsWith('/api/auth/logout')) return jsonResponse({ ok: true });
      if (url.endsWith('/api/health')) return jsonResponse({ ok: true, mode: 'mock' });
      if (url.endsWith('/api/pool')) return jsonResponse(emptySnapshot);
      return jsonResponse({ error: 'NOT_FOUND' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    useEnterprisePoolStore.setState({
      identity: {
        provider: 'mock',
        subject: 'ding-1',
        userId: 'ding-1',
        deviceId: 'windows-1',
        displayName: '用户 1',
      },
      snapshot: emptySnapshot,
    });

    await useEnterprisePoolStore.getState().logout();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:4174/api/leases/windows-1/release',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(useEnterprisePoolStore.getState()).toMatchObject({ identity: null, busy: false });
  });

  it('preserves the last good snapshot when polling fails', async () => {
    const snapshot: EnterprisePoolSnapshot = {
      ...emptySnapshot,
      accounts: [{ id: 'account-1', hourlyRemaining: 80, weeklyRemaining: 70 }],
    };
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline');
    }));
    useEnterprisePoolStore.setState({ snapshot, connected: true });

    await useEnterprisePoolStore.getState().refresh();

    expect(useEnterprisePoolStore.getState()).toMatchObject({
      snapshot,
      connected: false,
      error: 'offline',
    });
  });
});
