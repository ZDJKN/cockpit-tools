# Enterprise Pool Client MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the cockpit-tools fork to the mock CodexPoolMVP service and expose an enterprise-mode client loop for mock DingTalk login, exclusive lease request, FIFO waiting, low-quota prompt, confirmed switching, cancellation, and release.

**Architecture:** Add an isolated TypeScript client module and Zustand store so enterprise behavior does not modify existing Codex credential code. Render a lazy-loaded EnterprisePoolPage from a dedicated navigation entry. The first milestone consumes mock API state only and intentionally performs no auth.json or credential projection.

**Tech Stack:** React 19, TypeScript 5.8, Zustand 5, Vite 7, Vitest, existing cockpit-tools CSS tokens.

---

### Task 1: Typed enterprise pool API

**Files:**
- Create: `src/types/enterprisePool.ts`
- Create: `src/services/enterprisePoolService.ts`
- Create: `src/services/enterprisePoolService.test.ts`
- Modify: `package.json`

- [x] Add Vitest and an `npm test` script.
- [x] Write failing tests for base URL normalization, pool snapshot fetch, mock login, lease request, quota update, confirm/cancel, release, and stable API errors.
- [x] Run the focused test and confirm it fails because the service does not exist.
- [x] Implement the typed fetch client with `VITE_ENTERPRISE_POOL_URL` and `http://127.0.0.1:4174` fallback.
- [x] Re-run the focused tests and confirm they pass.

### Task 2: Enterprise pool state store

**Files:**
- Create: `src/stores/useEnterprisePoolStore.ts`
- Create: `src/stores/useEnterprisePoolStore.test.ts`

- [x] Write failing tests for derived device state: disconnected, available, leased, queued, and switch-pending.
- [x] Implement a focused Zustand store with login, refresh, request, release, quota simulation, confirm, and cancel actions.
- [x] Ensure polling errors preserve the last good snapshot and expose a user-readable error.
- [x] Run store tests and typecheck.

### Task 3: Enterprise account pool page

**Files:**
- Create: `src/pages/EnterprisePoolPage.tsx`
- Create: `src/pages/EnterprisePoolPage.css`
- Modify: `src/types/navigation.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/SideNav.tsx`

- [x] Add `enterprise-pool` to the Page union and renderable pages.
- [x] Lazy-load the page to avoid increasing the initial bundle.
- [x] Add a dedicated navigation entry in both classic and floating layouts.
- [x] Render connection status, mock DingTalk identity fields, lease/queue state, account quotas, switch prompt controls, and audit events.
- [x] Poll only while the page is mounted and stop polling on unmount.

### Task 4: Integration verification

**Files:**
- Modify: `README.md`

- [x] Document how to start CodexPoolMVP and set `VITE_ENTERPRISE_POOL_URL`.
- [x] Run `npm test`, `npm run typecheck`, and `npm run build` in cockpit-tools-enterprise.
- [x] Run the page against the healthy Docker backend at port 4174.
- [x] Verify three mock devices can lease, later devices queue, low quota prompts, cancel retains the lease, and confirm switches or queues.
- [x] Record that credential projection and real DingTalk OAuth remain out of scope for this milestone.
