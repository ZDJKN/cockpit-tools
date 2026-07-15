# Disable Application Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Disable Cockpit Tools application self-updates and remove every application-update prompt and user entry point from the enterprise Windows build.

**Architecture:** Add one explicit enterprise update policy that keeps application updates disabled, then make the React shell and settings UI obey that policy. Remove the upstream updater configuration, runtime plugin registration, and updater permission so a dormant or accidentally invoked code path still cannot contact or install the upstream release.

**Tech Stack:** React 19, TypeScript, Vitest, Tauri 2, Rust, JSON configuration.

---

### Task 1: Add regression coverage for the enterprise update policy

**Files:**
- Create: `src/config/applicationUpdatePolicy.test.ts`
- Create: `src/config/applicationUpdatePolicy.ts`

- [ ] **Step 1: Write the failing test**

Create a test that imports the enterprise application-update policy and asserts that background checks, manual checks, update prompts, and post-update notices are all disabled.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/config/applicationUpdatePolicy.test.ts`

Expected: FAIL because `applicationUpdatePolicy.ts` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Export one immutable policy object whose four update capabilities are `false`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/config/applicationUpdatePolicy.test.ts`

Expected: PASS.

### Task 2: Stop checks and remove update UI

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/components/AnnouncementCenter.tsx`

- [ ] **Step 1: Apply the policy to the application shell**

Return immediately from the startup/hourly update effect and version-jump effect when updates are disabled. Prevent update dialogs, version-jump dialogs, and the side-navigation update action from rendering.

- [ ] **Step 2: Apply the policy to settings**

Do not load or persist application-update settings. Remove the auto-update and update-reminder rows, the manual check button, the upstream release-history button, and its modal.

- [ ] **Step 3: Suppress remote update announcements**

Disable the upstream announcement surfaces for the enterprise build, and ignore announcement actions that request an application update check, so upstream content cannot recreate the deleted update prompt.

- [ ] **Step 4: Run focused tests and type checking**

Run: `npm test -- src/config/applicationUpdatePolicy.test.ts && npm run typecheck`

Expected: PASS with zero TypeScript errors.

### Task 3: Remove updater capability from the desktop bundle

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Remove the upstream feed**

Delete the updater public key and `jlcodes99/cockpit-tools` endpoints from `tauri.conf.json`.

- [ ] **Step 2: Remove runtime activation**

Stop registering `tauri_plugin_updater` while retaining the process and autostart plugins used by unrelated features.

- [ ] **Step 3: Remove updater permission**

Delete `updater:default` from the main window capability.

- [ ] **Step 4: Verify source isolation**

Run focused searches confirming no upstream updater endpoint, updater capability, or updater plugin registration remains in active desktop configuration.

### Task 4: Full verification and review

**Files:**
- Review all changed files.

- [ ] **Step 1: Run the full frontend test suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run type checking and production build**

Run: `npm run typecheck && npm run build`

Expected: both commands exit successfully.

- [ ] **Step 3: Run Rust validation**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`

Expected: exit successfully.

- [ ] **Step 4: Review the final diff**

Confirm that unrelated enterprise-pool behavior and user-owned untracked files are unchanged, and that the implementation matches every requirement above.
