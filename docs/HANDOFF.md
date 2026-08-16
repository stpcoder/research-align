# Research Align — Latest Session Handoff

Handoff prepared: **2026-08-16 22:14 KST**

This file is the first operational document to read after `AGENTS.md` when opening a new development session. It is intentionally overwritten at the end of each session.

## 1. Read first

Before doing anything else:

1. Read root `AGENTS.md`.
2. Read this file completely.
3. Read `docs/PROJECT_STATE.md`.
4. If working on researcher/admin UI, read `docs/ADMIN_DESIGN_SYSTEM.md`.
5. Verify actual GitHub `main` HEAD and live Supabase `deploy_control_state` before editing or deploying.

Do not rely on the SHA in this document as a substitute for live verification; writing this handoff itself creates a newer documentation-only commit.

## 2. Current session status

There is **no partially implemented runtime patch in flight**.

The previous application-development sequence finished with production code `dd5eab06280f78f37d5926f4d940ef697c04d4b0`, and production is READY on that code.

This session did not change application runtime behavior. It established persistent multi-session development documentation so future conversations can continue from the repository itself.

## 3. GitHub state

Repository:

`stpcoder/research-align`

Branch:

`main`

Application/runtime code baseline currently deployed:

`dd5eab06280f78f37d5926f4d940ef697c04d4b0`

Message:

`Fix date window type check`

After that runtime commit, documentation-only commits were added in this handoff-preparation session:

- `a2e71c277bd8f22f2d1e84f1f84cde2d2863bf51` — add persistent `AGENTS.md`
- `f39b17e4aaa42122981164bf420c63eacc61d5dd` — add `docs/PROJECT_STATE.md`
- `086fd92c08f1efdcc0505a39ce592ccf3a83aeff` — add `docs/DEVELOPMENT_LOG.md`
- the commit that adds this `docs/HANDOFF.md` is newer than the SHA above and must be discovered from live `main` on the next session

Important: these documentation-only commits have **not** been production-deployed, because they do not change application runtime behavior. Therefore GitHub `main` being ahead of production `commitSha` is expected at this handoff boundary.

## 4. Production deployment state

Live Supabase `deploy_control_state` was re-queried immediately before writing this handoff.

Current state:

- project: `research-align`
- Vercel project ID: `prj_m1b582jShPhKBRfxY8GLDxAPFrGQ`
- deployment ID: `dpl_AcPUSSgYSPxbhkVtK99BKACtTyQ5`
- status: `READY`
- production URL: `https://research-align.vercel.app`
- deployed application commit: `dd5eab06280f78f37d5926f4d940ef697c04d4b0`
- recorded deployment update: 2026-08-16 18:52:41 KST

Do not create a new Vercel project if the Vercel connector does not list this project. The connector's visible scope has previously differed from the operational control-plane scope.

## 5. Supabase production state

Project:

`rgwqsqeikebwunbdnbex`

Region:

`ap-northeast-1`

Status at the architecture verification pass:

`ACTIVE_HEALTHY`

Latest important applied migration from the previous runtime-development session:

`buffer_aware_schedule_conflicts`

The production database already contains the multi-study scheduling, cancellation notification, inquiry matching, ClawMail, and buffer-aware conflict changes described in `docs/PROJECT_STATE.md`.

## 6. What was done in this session

### Added root `AGENTS.md`

Purpose: durable instructions for all future AI/developer sessions.

It defines:

- mandatory reading order
- source-of-truth hierarchy
- production identifiers
- deployment-control architecture
- Vercel connector caveat
- build-time `page.tsx` rewrite caveat
- scheduling/database invariants
- contact/ClawMail boundaries
- public inquiry matching constraints
- security rules
- standard development workflow
- mandatory end-of-session documentation workflow
- recommended next-session prompt

### Added `docs/PROJECT_STATE.md`

Purpose: durable description of what the system currently is.

It captures:

- product scope
- production architecture
- application stack and source layout
- auth/multi-tenancy
- dashboard
- form builder
- participant flow
- owner-wide scheduling and lifecycle
- response management/export
- public inquiries
- contact state machine
- ClawMail transport
- schedule notification audit flow
- SMS/Google Calendar legacy status
- Supabase/Vercel deployment control plane
- active vs disabled Edge Functions
- core database objects
- known technical debt and hardening backlog

### Added `docs/DEVELOPMENT_LOG.md`

Purpose: append-only history across development sessions.

Initial entries summarize:

- this documentation/handoff setup
- multi-study operational improvements
- ClawMail/inquiry/notification work
- initial production/deployment-control architecture

### Added this `docs/HANDOFF.md`

Purpose: rolling latest state for the next conversation/session.

## 7. Important implementation state to preserve

The following are already implemented. Do not accidentally re-build them as if they were TODOs.

### Multi-study scheduling

- schedule view loads researcher-visible assignments across studies
- overlapping sessions across studies are blocked
- database trigger enforces owner-wide overlap prevention
- participant public busy intervals are owner-wide
- participant form rechecks busy intervals before submission
- duration and session buffer affect conflict calculations

### Scheduling lifecycle

- assignment statuses: `confirmed`, `completed`, `no_show`, `cancelled`
- cancellation preserves the row
- participant state distinguishes unscheduled/partial/scheduled/handled
- direct researcher-agreed scheduling exists
- session order and max-sessions-per-day exist
- date window navigation exists

### Form Builder

- date ranges / 7-day addition exist
- location exists
- participant instructions exist
- `bufferMinutes` exists
- dirty-state / unsaved-change warning exists

### Dashboard

- today's sessions
- unscheduled participants
- reply required
- mail failure
- per-study counts
- cross-study upcoming agenda

### Contact/email

- ClawMail is current email provider
- public inquiries exist
- inquiry/applicant matching exists
- contact thread states are pending/open/closed
- pending inquiry remains pending after automatic schedule email
- schedule emails are marked as automatic notices in conversation history
- schedule confirmation/change/cancellation notifications are audited
- provider failure does not roll back scheduling state

### Removed/non-current behavior

- SMS is not a current product feature
- Google Calendar is removed; remaining functions are HTTP 410 stubs
- KeyID is legacy, not the current email transport

## 8. Critical code-maintenance warning

Do not edit `src/app/page.tsx` assuming it is canonical.

`npm run dev` and `npm run build` execute:

`scripts/prebuild-ui-copy.mjs`

which rewrites `page.tsx` and swaps legacy inline implementations for current Unified components.

For current behavior, inspect/edit these first:

- `src/components/ResearchHome.tsx`
- `src/components/FormBuilderUnified.tsx`
- `src/components/ResponseManagerUnified.tsx`
- `src/components/ScheduleUnified.tsx`
- `src/components/ContactManager.tsx`

Removing the rewrite layer is valid technical-debt work, but it must be done deliberately with behavior parity.

## 9. Deployment procedure for a future runtime change

When the next session makes an actual runtime change:

1. verify current GitHub `main`
2. verify current `deploy_control_state`
3. modify/commit source
4. apply and verify Supabase migration/function changes if needed
5. run relevant build/type/lint checks
6. use the established Supabase deployment control plane, not a newly created Vercel project
7. wait for/verify READY
8. verify `deploy_control_state.details.commitSha` equals the intended runtime source SHA
9. test the relevant production path
10. disable/remove any temporary probe infrastructure
11. update this handoff and append the development log

Primary deployment architecture is documented in `deploy-control/README.md` and `docs/PROJECT_STATE.md`.

## 10. Known risks / unresolved items

### P0 before real participant scale

- **ClawMail quota/capacity**: E2E testing encountered `Daily send limit of 5 reached`. The application handles failure safely, but actual provider capacity must be resolved before substantial participant mail volume.

### P1 operational hardening

- `main` currently has no branch protection or required build/lint checks.
- production contains demo/test data and should be deliberately cleaned before a real pilot.
- provider/deploy probe and KeyID-era artifacts should be cleaned after dependency review.
- stale README / `SOURCE_MANIFEST.json` content should eventually be reconciled with current architecture.

### P1 maintainability

- eliminate `scripts/prebuild-ui-copy.mjs` source rewriting and make current UI source canonical.

### P2 DB/security/performance cleanup

- review/revoke unnecessary anonymous `create_demo_study()` EXECUTE privilege
- review intentionally public SECURITY DEFINER RPC grants
- consider Supabase leaked-password protection
- consider indexes for `contact_threads.response_id`, `notifications.response_id`, and `studies.owner_id`

## 11. Immediate next task

There is no unfinished code change that must be completed first.

The next session can start directly with the user's next requested product/development task after performing the baseline verification required by `AGENTS.md`.

If no new feature is specified, the recommended engineering order is:

1. resolve ClawMail sending capacity for pilot readiness
2. remove the build-time source rewrite while preserving behavior
3. add CI/branch protection
4. clean legacy/probe/docs state
5. security/index hardening

Do not silently perform these cleanup items when the user has asked for a different product feature; they are backlog priorities, not blockers for every change.

## 12. Temporary infrastructure status

No new temporary runtime probe was created in this documentation session.

Previously created testing functions were rechecked in the prior architecture pass and were disabled as JWT-required HTTP 410 stubs where applicable.

## 13. Verification performed in this documentation session

- confirmed current GitHub `main` after the first three documentation commits was `086fd92c08f1efdcc0505a39ce592ccf3a83aeff`
- re-queried `public.deploy_control_state`
- confirmed production deployment remains `dpl_AcPUSSgYSPxbhkVtK99BKACtTyQ5`
- confirmed deployment status remains `READY`
- confirmed deployed runtime code remains `dd5eab06280f78f37d5926f4d940ef697c04d4b0`
- no production deployment was triggered because this session changed documentation only

## 14. Suggested exact prompt for the next chat

> `stpcoder/research-align` 개발을 이어가자. GitHub `main`의 `AGENTS.md`, `docs/HANDOFF.md`, `docs/PROJECT_STATE.md`를 먼저 전부 읽어. UI 작업이면 `docs/ADMIN_DESIGN_SYSTEM.md`도 읽어. 문서 내용은 handoff로 사용하되, 작업 전에 실제 GitHub `main` HEAD와 Supabase `deploy_control_state`를 다시 확인해. 그 다음 내가 요청하는 개발을 기존 architecture와 invariant를 깨지 않게 진행하고, 필요하면 Supabase migration/Edge Function과 production deployment까지 끝까지 검증해. 세션 종료 전에는 `docs/HANDOFF.md`를 최신 상태로 교체하고 `docs/DEVELOPMENT_LOG.md`에 이번 작업을 append해.`
