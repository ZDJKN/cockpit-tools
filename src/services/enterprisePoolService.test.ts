import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  EnterprisePoolApiError,
  createEnterprisePoolClient,
  normalizeEnterprisePoolBaseUrl,
} from './enterprisePoolService';

describe('enterprisePoolService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('normalizes the configured base URL', () => {
    expect(normalizeEnterprisePoolBaseUrl(' http://127.0.0.1:4174/// ')).toBe(
      'http://127.0.0.1:4174',
    );
    expect(normalizeEnterprisePoolBaseUrl('')).toBe('http://127.0.0.1:4174');
  });

  it('fetches the current pool snapshot', async () => {
    const snapshot = {
      accounts: [],
      devices: [],
      leases: [],
      queue: [],
      quotaSnapshots: [],
      audit: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(snapshot), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await createEnterprisePoolClient('http://pool.test/').getPool();

    expect(result).toEqual(snapshot);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://pool.test/api/pool',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('maps desktop auth operations and keeps the Bearer session in the client', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/api/auth/mode')) return jsonResponse({ mode: 'mock' });
      if (url.endsWith('/api/auth/desktop/mock/login')) {
        return jsonResponse({
          status: 'completed',
          sessionToken: 'desktop-session',
          identity: { provider: 'mock', subject: 'mock-1', displayName: '用户 1' },
          deviceId: 'windows-1',
        });
      }
      if (url.endsWith('/api/auth/session')) {
        return jsonResponse({
          identity: { provider: 'mock', subject: 'mock-1', displayName: '用户 1' },
        });
      }
      return jsonResponse({ ok: true });
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = createEnterprisePoolClient('http://pool.test');

    await client.getAuthMode();
    const login = await client.desktopMockLogin({
      userId: 'mock-1',
      displayName: '用户 1',
      deviceId: 'windows-1',
    });
    client.setSessionToken(login.sessionToken);
    await client.getSession();
    await client.logout();

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://pool.test/api/auth/mode',
      'http://pool.test/api/auth/desktop/mock/login',
      'http://pool.test/api/auth/session',
      'http://pool.test/api/auth/logout',
    ]);
    expect(fetchMock.mock.calls[2]?.[1]).toEqual(
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({ authorization: 'Bearer desktop-session' }),
      }),
    );
  });

  it('maps DingTalk desktop start and poll routes', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => jsonResponse({ status: 'pending', pollAfterMs: 1500 }));
    vi.stubGlobal('fetch', fetchMock);
    const client = createEnterprisePoolClient('http://pool.test');

    await client.startDesktopLogin('windows-1');
    await client.pollDesktopLogin('transaction-1', 'verifier-1');

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://pool.test/api/auth/desktop/start',
      'http://pool.test/api/auth/desktop/poll',
    ]);
  });

  it('maps login, lease, quota, switch and release operations to API routes', async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = createEnterprisePoolClient('http://pool.test');

    await client.mockLogin({ userId: 'ding-1', deviceId: 'windows-1', displayName: '用户 1' });
    await client.requestLease('windows-1');
    await client.updateQuota('account-1', 9, 80);
    await client.confirmSwitch('windows-1');
    await client.cancelSwitch('windows-1');
    await client.releaseLease('windows-1');

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://pool.test/api/mock/login',
      'http://pool.test/api/leases/request',
      'http://pool.test/api/accounts/account-1/quota',
      'http://pool.test/api/leases/windows-1/switch/confirm',
      'http://pool.test/api/leases/windows-1/switch/cancel',
      'http://pool.test/api/leases/windows-1/release',
    ]);
  });

  it('throws a stable API error with the backend code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'NO_ACTIVE_LEASE' }), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    const operation = createEnterprisePoolClient().confirmSwitch('windows-1');

    await expect(operation).rejects.toMatchObject({
      name: 'EnterprisePoolApiError',
      code: 'NO_ACTIVE_LEASE',
      status: 409,
    } satisfies Partial<EnterprisePoolApiError>);
  });
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
