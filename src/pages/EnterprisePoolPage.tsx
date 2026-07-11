import { useEffect, useMemo, useState } from 'react';
import { Building2, CircleAlert, Clock3, LogIn, LogOut, RefreshCw, RotateCcw, Server, UserRound } from 'lucide-react';

import {
  deriveEnterpriseDeviceState,
  useEnterprisePoolStore,
} from '../stores/useEnterprisePoolStore';
import './EnterprisePoolPage.css';

const POLL_INTERVAL_MS = 3_000;

function formatPercent(value: number): string {
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp));
}

export function EnterprisePoolPage() {
  const identity = useEnterprisePoolStore((state) => state.identity);
  const snapshot = useEnterprisePoolStore((state) => state.snapshot);
  const connected = useEnterprisePoolStore((state) => state.connected);
  const busy = useEnterprisePoolStore((state) => state.busy);
  const error = useEnterprisePoolStore((state) => state.error);
  const refresh = useEnterprisePoolStore((state) => state.refresh);
  const login = useEnterprisePoolStore((state) => state.login);
  const requestLease = useEnterprisePoolStore((state) => state.requestLease);
  const releaseLease = useEnterprisePoolStore((state) => state.releaseLease);
  const updateQuota = useEnterprisePoolStore((state) => state.updateQuota);
  const confirmSwitch = useEnterprisePoolStore((state) => state.confirmSwitch);
  const cancelSwitch = useEnterprisePoolStore((state) => state.cancelSwitch);
  const clearIdentity = useEnterprisePoolStore((state) => state.clearIdentity);

  const [userId, setUserId] = useState(identity?.userId ?? 'ding-user-1');
  const [deviceId, setDeviceId] = useState(identity?.deviceId ?? 'windows-1');
  const [displayName, setDisplayName] = useState(identity?.displayName ?? '测试用户 1');
  const [releaseConfirmationVisible, setReleaseConfirmationVisible] = useState(false);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const deviceState = useMemo(
    () => deriveEnterpriseDeviceState(snapshot ?? {
      accounts: [], devices: [], leases: [], queue: [], quotaSnapshots: [], audit: [],
    }, identity?.deviceId ?? null),
    [identity?.deviceId, snapshot],
  );

  const recentAudit = snapshot?.audit.slice(-12).reverse() ?? [];

  const handleLogin = async () => {
    await login({ userId: userId.trim(), deviceId: deviceId.trim(), displayName: displayName.trim() });
  };

  const handleRelease = async () => {
    await releaseLease();
    setReleaseConfirmationVisible(false);
  };

  return (
    <div className="enterprise-pool-page">
      <header className="enterprise-pool-hero">
        <div className="enterprise-pool-title">
          <span className="enterprise-pool-title-icon"><Building2 size={22} /></span>
          <div>
            <h1>企业账号池</h1>
            <p>模拟钉钉身份 · 排他租约 · 额度确认切换</p>
          </div>
        </div>
        <div className={`enterprise-pool-connection ${connected ? 'online' : 'offline'}`}>
          <span aria-hidden="true" />
          {connected ? '账号池已连接' : '账号池未连接'}
        </div>
      </header>

      {error ? <div className="enterprise-pool-error" role="alert"><CircleAlert size={17} />{error}</div> : null}

      <section className="enterprise-pool-grid enterprise-pool-top-grid">
        <article className="enterprise-pool-card">
          <div className="enterprise-pool-card-heading"><UserRound size={18} /><h2>企业身份</h2></div>
          {identity ? (
            <div className="enterprise-pool-identity">
              <strong>{identity.displayName}</strong>
              <span>{identity.userId}</span>
              <span>{identity.deviceId}</span>
              <button className="btn btn-secondary" type="button" onClick={() => void clearIdentity()} disabled={busy}>
                <LogOut size={15} />清除本机身份
              </button>
            </div>
          ) : (
            <div className="enterprise-pool-login-form">
              <label>钉钉用户 ID<input value={userId} onChange={(event) => setUserId(event.target.value)} autoComplete="off" /></label>
              <label>Windows 设备 ID<input value={deviceId} onChange={(event) => setDeviceId(event.target.value)} autoComplete="off" /></label>
              <label>显示名称<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="off" /></label>
              <button className="btn btn-primary" type="button" onClick={() => void handleLogin()} disabled={busy || !userId.trim() || !deviceId.trim() || !displayName.trim()}>
                <LogIn size={15} />模拟钉钉登录
              </button>
            </div>
          )}
        </article>

        <article className="enterprise-pool-card">
          <div className="enterprise-pool-card-heading"><Server size={18} /><h2>当前设备状态</h2></div>
          <div className={`enterprise-pool-device-state state-${deviceState.kind}`}>
            <strong>{deviceState.kind === 'signed_out' ? '尚未登录' : deviceState.kind === 'ready' ? '可以领取账号' : deviceState.kind === 'queued' ? `等待队列第 ${deviceState.position} 位` : deviceState.kind === 'switch_pending' ? '额度不足，等待确认' : `已领取 ${deviceState.account.id}`}</strong>
            {deviceState.kind === 'leased' || deviceState.kind === 'switch_pending' ? (
              <div className="enterprise-pool-current-quota">
                <span>Hourly {formatPercent(deviceState.account.hourlyRemaining)}</span>
                <span>Weekly {formatPercent(deviceState.account.weeklyRemaining)}</span>
              </div>
            ) : null}
          </div>
          <div className="enterprise-pool-actions">
            {deviceState.kind === 'ready' ? <button className="btn btn-primary" type="button" onClick={() => void requestLease()} disabled={busy}>领取可用账号</button> : null}
            {deviceState.kind === 'leased' && !releaseConfirmationVisible ? <button className="btn btn-danger" type="button" onClick={() => setReleaseConfirmationVisible(true)} disabled={busy}>释放租约</button> : null}
            {deviceState.kind === 'leased' && releaseConfirmationVisible ? (
              <><span className="enterprise-pool-release-warning">确认释放？下一台设备可能立即补位。</span><button className="btn btn-danger" type="button" onClick={() => void handleRelease()} disabled={busy}>确认释放</button><button className="btn btn-secondary" type="button" onClick={() => setReleaseConfirmationVisible(false)} disabled={busy}>取消</button></>
            ) : null}
            {deviceState.kind === 'switch_pending' ? (
              <><button className="btn btn-primary" type="button" onClick={() => void confirmSwitch()} disabled={busy}><RotateCcw size={15} />确认换号</button><button className="btn btn-secondary" type="button" onClick={() => void cancelSwitch()} disabled={busy}>暂不切换</button></>
            ) : null}
            <button className="btn btn-secondary" type="button" onClick={() => void refresh()} disabled={busy}><RefreshCw size={15} />刷新</button>
          </div>
        </article>
      </section>

      <section className="enterprise-pool-card">
        <div className="enterprise-pool-card-heading"><h2>模拟账号</h2><span>{snapshot?.accounts.length ?? 0} 个</span></div>
        <div className="enterprise-pool-account-grid">
          {(snapshot?.accounts ?? []).map((account) => {
            const lease = snapshot?.leases.find((item) => item.accountId === account.id);
            return (
              <article className="enterprise-pool-account" key={account.id}>
                <div><strong>{account.id}</strong><span>{lease ? `占用：${lease.deviceId}` : '可用'}</span></div>
                <div className="enterprise-pool-quota-row"><span>Hourly</span><progress max="100" value={account.hourlyRemaining} /><b>{formatPercent(account.hourlyRemaining)}</b></div>
                <div className="enterprise-pool-quota-row"><span>Weekly</span><progress max="100" value={account.weeklyRemaining} /><b>{formatPercent(account.weeklyRemaining)}</b></div>
                <div className="enterprise-pool-account-actions">
                  <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void updateQuota(account.id, 9, account.weeklyRemaining)}>Hourly 降到 9%</button>
                  <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void updateQuota(account.id, account.hourlyRemaining, 9)}>Weekly 降到 9%</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="enterprise-pool-grid enterprise-pool-bottom-grid">
        <article className="enterprise-pool-card">
          <div className="enterprise-pool-card-heading"><Clock3 size={18} /><h2>等待队列</h2></div>
          <div className="enterprise-pool-list">
            {(snapshot?.queue ?? []).length ? snapshot?.queue.map((entry, index) => <div key={entry.deviceId}><b>#{index + 1}</b><span>{entry.deviceId}</span></div>) : <p className="enterprise-pool-empty">当前无人等待</p>}
          </div>
        </article>
        <article className="enterprise-pool-card">
          <div className="enterprise-pool-card-heading"><h2>最近事件</h2></div>
          <div className="enterprise-pool-list enterprise-pool-audit">
            {recentAudit.length ? recentAudit.map((event, index) => <div key={`${event.createdAt}-${index}`}><span>{event.type} · {event.deviceId ?? 'system'} {event.accountId ?? ''}</span><time>{formatTime(event.createdAt)}</time></div>) : <p className="enterprise-pool-empty">暂无事件</p>}
          </div>
        </article>
      </section>
    </div>
  );
}
