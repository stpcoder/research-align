# Research Align — Development Log

This is the append-only chronological development history for AI-agent and developer sessions.

Rules:

- Add new entries at the top, below this header.
- Do not rewrite old entries just to make the story cleaner.
- Keep entries factual: what changed, what was verified, important regressions/bugs, and relevant commit/migration/deployment references.
- Put only durable history here. The immediate next action belongs in `docs/HANDOFF.md`.
- Never include secret values.

---

## 2026-08-16 KST — Cross-session commit and recovery protocol hardened

### Goal

Turn the repository from a passive handoff document store into an explicit operating system for development across many ChatGPT/Codex conversations.

The user requirement was that completed modifications be committed reliably and that a new conversation be able to continue immediately without reconstructing context from old chat history.

### Commit

- `babaa5dde98921299e79bff9fd1040cbb4ecb6b5` — `docs(dev): establish cross-session commit protocol`

This was deliberately created as one atomic multi-file commit using a Git tree because all three documentation changes form one logical development-process feature.

### Changed

- strengthened root `AGENTS.md`
  - one logical change per commit
  - atomic multi-file commit rule
  - commit completed checkpoints promptly
  - direct-main rule for small verified fixes
  - `work/YYYYMMDD-<topic>` branch rule for large/risky/multi-session work
  - conventional commit categories
  - DB migration/source synchronization rules
  - expand/deploy/contract guidance for breaking DB changes
  - final handoff as its own commit
  - interrupted-session recovery procedure
- added `docs/SESSION_PROTOCOL.md`
  - explicit five-state model: source / DB / Edge Function / app deployment / behavior verification
  - mandatory session preflight
  - repeatable logical work-item loop
  - branch strategy
  - DB and Edge rollout procedure
  - production deployment verification
  - crash/interruption recovery algorithm
- added `docs/HANDOFF_TEMPLATE.md`
  - exact branch/commit/runtime/deployment fields
  - in-progress boundary
  - migrations and Edge Function tables
  - verification evidence
  - source/deployment drift explanation
  - exact next action
  - recovery instructions

### Verification

- confirmed `main` before the protocol commit was `079fe2d51eb2d91d603fa06a70dc5896b6e2d9cd`
- created the protocol changes as one Git tree and commit
- fast-forwarded `main` to `babaa5dde98921299e79bff9fd1040cbb4ecb6b5`
- re-read branch metadata and confirmed `main` points to `babaa5...`
- re-queried live Supabase `deploy_control_state`
- confirmed production remains `READY` on deployment `dpl_AcPUSSgYSPxbhkVtK99BKACtTyQ5`
- confirmed production still runs runtime commit `dd5eab06280f78f37d5926f4d940ef697c04d4b0`
- no production deployment was triggered because the changes are repository-process documentation only

### Durable operating rule established

Every future session should lose at most the currently incomplete logical unit if interrupted. Every completed independent change should already exist as a retrievable Git commit before the next independent change begins.

---

## 2026-08-16 KST — Persistent multi-session development handoff established

### Goal

Make the repository itself sufficient context for future ChatGPT/Codex sessions so development can continue across conversation boundaries without relying on old chat history.

### Added

- root `AGENTS.md`
  - session-start reading order
  - source-of-truth hierarchy
  - deployment-control rules
  - build-time rewrite warning
  - scheduling/database invariants
  - ClawMail/contact boundaries
  - security rules
  - mandatory session-end documentation protocol
  - recommended prompt for future sessions
- `docs/PROJECT_STATE.md`
  - durable architecture and feature inventory
  - production topology
  - scheduling/contact/email/deployment behavior
  - known technical debt and hardening backlog
- `docs/DEVELOPMENT_LOG.md`
  - this append-only history
- `docs/HANDOFF.md`
  - rolling latest-session handoff for the next agent/session

### Baseline verified before writing the documentation

- application/runtime code baseline: `dd5eab06280f78f37d5926f4d940ef697c04d4b0`
- commit message: `Fix date window type check`
- production deployment for that code: `dpl_AcPUSSgYSPxbhkVtK99BKACtTyQ5`
- production status: `READY`
- production URL: `https://research-align.vercel.app`
- production deployment state recorded the same code SHA, `dd5eab...`
- Supabase project: `rgwqsqeikebwunbdnbex`, healthy in `ap-northeast-1`

Documentation commits made after `dd5eab...` move GitHub `main` forward without changing the application runtime code. Future sessions must always query the actual current HEAD and `deploy_control_state` rather than assuming the SHA in an old log entry is still current.

### Important state discovered/reconfirmed

- Earlier handoff text that called `c010fab...` the current HEAD was stale. Two later application commits existed:
  - `a33d2cefe7a16982b3ffdc33a54a4d2b56bf30a8` — range scheduling and study lifecycle controls
  - `dd5eab06280f78f37d5926f4d940ef697c04d4b0` — date-window type-check fix
- Features previously listed as future work were already implemented:
  - 4-date scheduling window
  - unsaved-change warning
  - session location
  - participant instructions
  - session buffer time
  - date-range / 7-day form-builder controls
  - permanent study deletion with typed-title confirmation
- production DB had the latest `buffer_aware_schedule_conflicts` migration applied.
- owner-wide public busy interval behavior remained verified with an example where one study had 5 own busy intervals while owner-wide busy intervals returned 11.
- no study `form_config` contained SMS/문자 안내 copy at verification time.
- Google Calendar functions were confirmed to be disabled HTTP 410 stubs.
- direct production/probe functions used during testing were confirmed disabled behind JWT + HTTP 410 stubs, including `direct-prod-deploy`, `ops-cancel-probe`, and `range-delete-deploy-probe`.
- ClawMail is the live email transport; Supabase contact tables remain the communication source of truth.
- Vercel connector visibility did not match the operational deployment credential scope; Supabase `deploy_control_state` is the required reference before any project-level Vercel action.
- `main` had no branch protection or required checks.
- build-time `scripts/prebuild-ui-copy.mjs` remains a major maintenance caveat because it rewrites `src/app/page.tsx` before dev/build.

### Known risks carried forward

- ClawMail runtime send quota needs resolution before real participant-scale operation.
- build-time source rewriting should eventually be removed.
- branch protection / CI gates are absent.
- stale KeyID-era docs/config and legacy/probe infrastructure remain.
- Supabase advisor findings need review/minimal hardening.
- production still contains demo/test data.

---

## 2026-08-16 KST — Multi-study operations and buffer-aware scheduling completed

### Key application commits

- `92013f5aab948b8fb535601d2040c0e72db3e31f` — `Improve multi-study research operations`
- `c010fab18da545118cdc4f26c6e08c99cc074cc8` — `Allow schedule cancellation notifications`
- `a33d2cefe7a16982b3ffdc33a54a4d2b56bf30a8` — `Add range scheduling and study lifecycle controls`
- `dd5eab06280f78f37d5926f4d940ef697c04d4b0` — `Fix date window type check`

### Major product changes

- researcher home converted into an operational dashboard with:
  - today schedule count
  - unscheduled participant count
  - reply-needed count
  - mail-failure count
  - per-study action counters
  - cross-study upcoming agenda
- schedule workspace changed from study-local collision handling to researcher-owner-wide collision handling.
- participant public busy intervals expanded to include all studies owned by the researcher.
- assignment lifecycle standardized around confirmed/completed/no_show/cancelled.
- cancellation stopped deleting assignment rows and instead preserves `cancelled` history.
- schedule cancellation notification kind added to the database constraint and email function.
- participant scheduling list gained search and lifecycle filters.
- contact UI gained search, pending-first sorting, automatic schedule-mail labels, and corrected pending/open/closed semantics.
- schedule automatic messages no longer clear a pending participant inquiry.
- SMS-oriented form expectations were removed from study forms.
- form builder gained date ranges, session location/instructions/buffer, and dirty-state warning.
- schedule collision logic became buffer-aware in both frontend and PostgreSQL.

### E2E findings

- DB trigger successfully rejected an intentionally overlapping assignment across two studies owned by the same researcher.
- public busy-interval query returned owner-wide occupancy rather than study-local occupancy.
- schedule cancellation notification initially failed before provider delivery because `notifications_kind_check` allowed only `schedule_confirmation`; migration `allow_schedule_cancellation_notifications` fixed it.
- ClawMail testing reached a runtime `Daily send limit of 5 reached` condition. Application behavior correctly retained the schedule change and marked notification delivery failed rather than rolling back the assignment.

### Deployment state after the final application changes

The production control plane eventually recorded application code `dd5eab...` as a READY deployment on the persistent `research-align` Vercel project.

---

## 2026-08-16 KST — ClawMail contact and schedule notification path established

### Major changes

- ClawMail added as the current email provider.
- study-specific provider material stored in `private.clawmail_material`.
- researcher contact UI can provision a study mailbox, sync inbound mail, and send replies.
- public pre-application inquiry widget added to participant pages.
- inquiry threads can later match to participant applications using conservative email/name matching.
- schedule confirmation/change email introduced with notification auditing.
- automatic schedule emails written into the participant contact conversation with metadata identifying them as schedule notifications.

### Relevant historical commits

- `ee76e0503d4fa09a927edf8797cc5bd0c793dc7d` — public inquiry form
- `cb563c3f472ac0aeb7246ecd126abacebfe649f7` — inquiry/applicant matching
- `f99447165de5993bcd6ddf41fefa740414a80710` — matched inquiry integration in participant contact view
- `f62cdd4ace14a60a20c163a8a6f3f3941798a76f` — notification delivery tracking
- `ac50c338f525aaf2603a28eda79aaeeb06db42a1` — schedule confirmation email function
- `825c26716f4e299eb9b8f6712e8177de6414986f` — send and track schedule confirmation email
- `709a33c5f69b011878694055468e759dff5f7476` — preserve inquiry state during automatic schedule notifications

---

## 2026-08-15 to 2026-08-16 KST — Initial production architecture and deployment control plane

### Foundation

- Next.js + Supabase researcher/participant application established.
- multi-tenant researcher ownership and RLS added.
- form builder, participant application, response storage, schedule assignment, and contact workspace established.
- private KeyID experiments were performed early in development but ceased to be the current email path.

### Deployment architecture

A server-side Supabase deployment control plane was created so production deployment does not depend on Vercel GitHub App repository authorization.

Primary path became:

```text
GitHub source
  -> deploy_control_jobs
  -> pg_net trigger
  -> vercel-control Edge Function
  -> Vercel REST / Files Deployment
  -> deploy_control_state
```

The initial Vercel bootstrap token was rotated to a dedicated deploy-control token and recorded as revoked afterward.

GitHub Actions deployment remains a manual fallback.
