# Course Submission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the verified enterprise account-pool Mock MVP as a complete AI product course submission with a polished proposal, Demo evidence, retrospective, source archives, and a verified zip.

**Architecture:** Keep course artifacts in a standalone delivery directory so the product repositories stay clean. Author one canonical Markdown proposal, generate DOCX/PDF versions from the same content, collect reproducible Demo evidence, and archive source through Git rather than copying working directories.

**Tech Stack:** Markdown, python-docx, LibreOffice renderer, Poppler, Git archive, zip, existing React/Fastify Mock MVP.

---

### Task 1: Canonical written content

**Files:**
- Create: `结课作业/企业Codex账号池助手-AI产品完整方案.md`
- Create: `结课作业/README-如何体验Demo.md`
- Create: `结课作业/项目复盘.md`

- [ ] Write the seven required sections with explicit current-vs-future boundaries.
- [ ] Add the user flow, AI decision flow, measurable benefits, and verified Demo evidence.
- [ ] Scan for placeholders, contradictions, and unsupported completion claims.

### Task 2: Demo evidence

**Files:**
- Create: `结课作业/Demo截图/01-客户端原型.png`
- Create: `结课作业/Demo截图/02-后端模拟控制台.png`
- Create: `结课作业/Demo截图/03-增长方案图.png`
- Create: `结课作业/验证结果.txt`

- [ ] Capture the two running pages without transmitting credentials.
- [ ] Copy the existing growth infographic.
- [ ] Run tests, typecheck, build/demo commands and record concise results.

### Task 3: Word and PDF proposal

**Files:**
- Create: `结课作业/企业Codex账号池助手-AI产品完整方案.docx`
- Create: `结课作业/企业Codex账号池助手-AI产品完整方案.pdf`

- [ ] Generate the DOCX with narrative_proposal tokens and editorial_cover first page.
- [ ] Render DOCX pages to PNG and inspect every page.
- [ ] Fix all visual defects and re-render.
- [ ] Render the final PDF and inspect every page.

### Task 4: Source archives and final package

**Files:**
- Create: `结课作业/源码/cockpit-tools-enterprise.zip`
- Create: `结课作业/源码/CodexPoolMVP.zip`
- Create: `企业Codex账号池助手-结课作业.zip`

- [ ] Create clean Git archives from the verified feature branches.
- [ ] Build the final zip and list its entries.
- [ ] Extract the zip into a temporary directory and verify every required artifact opens.
- [ ] Record SHA-256 and final file size.

