export type EnterpriseLeaseStatus = 'active' | 'switch_pending';

export interface EnterprisePoolAccount {
  id: string;
  hourlyRemaining: number;
  weeklyRemaining: number;
}

export interface EnterprisePoolDevice {
  id: string;
  userId: string;
  displayName: string;
}

export interface EnterprisePoolLease {
  id: string;
  accountId: string;
  deviceId: string;
  status: EnterpriseLeaseStatus;
  createdAt: number;
}

export interface EnterprisePoolQueueEntry {
  deviceId: string;
  queuedAt: number;
}

export interface EnterprisePoolQuotaSnapshot {
  accountId: string;
  hourlyRemaining: number;
  weeklyRemaining: number;
  capturedAt: number;
}

export interface EnterprisePoolAuditEvent {
  type: string;
  deviceId?: string;
  accountId?: string;
  createdAt: number;
}

export interface EnterprisePoolSnapshot {
  accounts: EnterprisePoolAccount[];
  devices: EnterprisePoolDevice[];
  leases: EnterprisePoolLease[];
  queue: EnterprisePoolQueueEntry[];
  quotaSnapshots: EnterprisePoolQuotaSnapshot[];
  audit: EnterprisePoolAuditEvent[];
}

export interface EnterprisePoolLoginInput {
  userId: string;
  deviceId: string;
  displayName: string;
}

export type EnterpriseLeaseResult =
  | { status: 'leased'; leaseId: string; accountId: string; deviceId: string }
  | { status: 'queued'; deviceId: string; position: number };

export interface EnterprisePoolHealth {
  ok: boolean;
  mode: 'mock';
}
