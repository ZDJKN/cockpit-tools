import type {
  EnterpriseLeaseResult,
  EnterpriseAuthMode,
  EnterpriseDesktopLoginCompleted,
  EnterpriseDesktopLoginInput,
  EnterpriseDesktopLoginPoll,
  EnterpriseDesktopLoginStart,
  EnterpriseIdentity,
  EnterprisePoolHealth,
  EnterprisePoolLoginInput,
  EnterprisePoolSnapshot,
} from '../types/enterprisePool';

const FALLBACK_ENTERPRISE_POOL_URL = 'http://127.0.0.1:4174';

export function normalizeEnterprisePoolBaseUrl(value?: string | null): string {
  const normalized = value?.trim().replace(/\/+$/, '');
  const selected = normalized || FALLBACK_ENTERPRISE_POOL_URL;
  let parsed: URL;
  try {
    parsed = new URL(selected);
  } catch {
    throw new Error('ENTERPRISE_POOL_URL_INVALID');
  }
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && loopback)) {
    throw new Error('ENTERPRISE_POOL_HTTPS_REQUIRED');
  }
  return selected;
}

export class EnterprisePoolApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = 'EnterprisePoolApiError';
  }
}

export interface EnterprisePoolClient {
  getAuthMode(): Promise<{ mode: EnterpriseAuthMode }>;
  desktopMockLogin(input: EnterpriseDesktopLoginInput): Promise<EnterpriseDesktopLoginCompleted>;
  startDesktopLogin(deviceId: string): Promise<EnterpriseDesktopLoginStart>;
  pollDesktopLogin(transactionId: string, verifier: string): Promise<EnterpriseDesktopLoginPoll>;
  getSession(): Promise<{ identity: EnterpriseIdentity }>;
  logout(): Promise<{ ok: true }>;
  setSessionToken(token: string | null): void;
  getHealth(): Promise<EnterprisePoolHealth>;
  getPool(): Promise<EnterprisePoolSnapshot>;
  mockLogin(input: EnterprisePoolLoginInput): Promise<EnterprisePoolLoginInput & { mode: 'mock' }>;
  requestLease(deviceId: string): Promise<EnterpriseLeaseResult>;
  updateQuota(accountId: string, hourlyRemaining: number, weeklyRemaining: number): Promise<{ ok: true }>;
  confirmSwitch(deviceId: string): Promise<EnterpriseLeaseResult>;
  cancelSwitch(deviceId: string): Promise<{ ok: true }>;
  releaseLease(deviceId: string): Promise<{ ok: true }>;
  uploadCredential(accountId: string, credential: string): Promise<{ ok: true }>;
  claimCredential(leaseId: string, deviceId: string): Promise<{ credential: string; accountId: string }>;
}

export function createEnterprisePoolClient(baseUrl?: string | null): EnterprisePoolClient {
  const resolvedBaseUrl = normalizeEnterprisePoolBaseUrl(
    baseUrl ?? import.meta.env.VITE_ENTERPRISE_POOL_URL,
  );
  let sessionToken: string | null = null;

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${resolvedBaseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        accept: 'application/json',
        ...(sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}),
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...init.headers,
      },
    });
    const payload = (await response.json()) as T | { error?: string };
    if (!response.ok) {
      const code =
        typeof payload === 'object' && payload !== null && 'error' in payload && payload.error
          ? payload.error
          : `HTTP_${response.status}`;
      throw new EnterprisePoolApiError(code, response.status);
    }
    return payload as T;
  }

  const post = <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  return {
    getAuthMode: () => request<{ mode: EnterpriseAuthMode }>('/api/auth/mode'),
    desktopMockLogin: (input) =>
      post<EnterpriseDesktopLoginCompleted>('/api/auth/desktop/mock/login', input),
    startDesktopLogin: (deviceId) =>
      post<EnterpriseDesktopLoginStart>('/api/auth/desktop/start', { deviceId }),
    pollDesktopLogin: (transactionId, verifier) =>
      post<EnterpriseDesktopLoginPoll>('/api/auth/desktop/poll', { transactionId, verifier }),
    getSession: () => request<{ identity: EnterpriseIdentity }>('/api/auth/session'),
    logout: async () => {
      const result = await post<{ ok: true }>('/api/auth/logout');
      sessionToken = null;
      return result;
    },
    setSessionToken: (token) => {
      sessionToken = token;
    },
    getHealth: () => request<EnterprisePoolHealth>('/api/health'),
    getPool: () => request<EnterprisePoolSnapshot>('/api/pool'),
    mockLogin: (input) =>
      post<EnterprisePoolLoginInput & { mode: 'mock' }>('/api/mock/login', input),
    requestLease: (deviceId) => post<EnterpriseLeaseResult>('/api/leases/request', { deviceId }),
    updateQuota: (accountId, hourlyRemaining, weeklyRemaining) =>
      post<{ ok: true }>(`/api/accounts/${encodeURIComponent(accountId)}/quota`, {
        hourlyRemaining,
        weeklyRemaining,
      }),
    confirmSwitch: (deviceId) =>
      post<EnterpriseLeaseResult>(
        `/api/leases/${encodeURIComponent(deviceId)}/switch/confirm`,
      ),
    cancelSwitch: (deviceId) =>
      post<{ ok: true }>(`/api/leases/${encodeURIComponent(deviceId)}/switch/cancel`),
    releaseLease: (deviceId) =>
      post<{ ok: true }>(`/api/leases/${encodeURIComponent(deviceId)}/release`),
    uploadCredential: (accountId, credential) =>
      post<{ ok: true }>(`/api/accounts/${encodeURIComponent(accountId)}/credential`, { credential }),
    claimCredential: (leaseId, deviceId) =>
      post<{ credential: string; accountId: string }>(
        `/api/leases/${encodeURIComponent(leaseId)}/claim-credential`,
        { deviceId },
      ),
  };
}
