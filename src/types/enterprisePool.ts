export type EnterpriseLeaseStatus = 'active' | 'switch_pending';

export interface EnterprisePoolAccount {
  id: string;
  hourlyRemaining: number;
  weeklyRemaining: number;
  /** 是否有已上传的凭据 */
  hasCredential?: boolean;
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

export type EnterpriseAuthMode = 'mock' | 'dingtalk';

export interface EnterpriseIdentity {
  provider: EnterpriseAuthMode;
  subject: string;
  displayName: string;
  credentialAdmin?: boolean;
}

export interface EnterpriseDesktopLoginInput {
  userId: string;
  displayName: string;
  deviceId: string;
}

export interface EnterpriseDesktopLoginCompleted {
  status: 'completed';
  sessionToken: string;
  identity: EnterpriseIdentity;
  deviceId: string;
}

export interface EnterpriseDesktopLoginStart {
  transactionId: string;
  verifier: string;
  loginUrl: string;
  expiresAt: number;
  pollAfterMs: number;
}

export type EnterpriseDesktopLoginPoll =
  | { status: 'pending'; pollAfterMs: number }
  | EnterpriseDesktopLoginCompleted;

export type EnterpriseLeaseResult =
  | { status: 'leased'; leaseId: string; accountId: string; deviceId: string }
  | { status: 'queued'; deviceId: string; position: number };

export interface EnterprisePoolHealth {
  ok: boolean;
  ready?: boolean;
  mode: EnterpriseAuthMode;
  database?: 'memory' | 'sqlite' | 'postgres';
}
