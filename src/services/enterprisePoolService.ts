import type {
  EnterpriseLeaseResult,
  EnterprisePoolHealth,
  EnterprisePoolLoginInput,
  EnterprisePoolSnapshot,
} from '../types/enterprisePool';

const FALLBACK_ENTERPRISE_POOL_URL = 'http://127.0.0.1:4174';

export function normalizeEnterprisePoolBaseUrl(value?: string | null): string {
  const normalized = value?.trim().replace(/\/+$/, '');
  return normalized || FALLBACK_ENTERPRISE_POOL_URL;
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
  getHealth(): Promise<EnterprisePoolHealth>;
  getPool(): Promise<EnterprisePoolSnapshot>;
  mockLogin(input: EnterprisePoolLoginInput): Promise<EnterprisePoolLoginInput & { mode: 'mock' }>;
  requestLease(deviceId: string): Promise<EnterpriseLeaseResult>;
  updateQuota(accountId: string, hourlyRemaining: number, weeklyRemaining: number): Promise<{ ok: true }>;
  confirmSwitch(deviceId: string): Promise<EnterpriseLeaseResult>;
  cancelSwitch(deviceId: string): Promise<{ ok: true }>;
  releaseLease(deviceId: string): Promise<{ ok: true }>;
}

export function createEnterprisePoolClient(baseUrl?: string | null): EnterprisePoolClient {
  const resolvedBaseUrl = normalizeEnterprisePoolBaseUrl(
    baseUrl ?? import.meta.env.VITE_ENTERPRISE_POOL_URL,
  );

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${resolvedBaseUrl}${path}`, {
      ...init,
      headers: {
        accept: 'application/json',
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
  };
}
