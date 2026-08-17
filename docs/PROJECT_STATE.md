# Research Align — Current Project State

Last architecture review: **2026-08-17 KST**

This document describes the durable current product and infrastructure state. It is not a session log. For exact current SHAs, deployments, verification evidence, and unfinished work, read `docs/HANDOFF.md` and `docs/CHANGE_LEDGER.md`.

## 1. Product purpose

Research Align / StudyForm is a researcher-operated workspace for human-subject study operations. One researcher account can own and run multiple studies, including:

- participant-facing application forms
- availability collection and preference ranking
- multi-session scheduling
- researcher-wide schedule conflict prevention across studies
- participant lifecycle tracking
- participant and pre-application inquiry management
- schedule confirmation/change/cancellation email
- operational dashboard and failure attention states

The researcher workflow is participant-centered: when a researcher moves among applicant details, schedule coordination, and contact, the selected participant should remain the active operational context rather than forcing the researcher to find the same person again.

## 2. Production topology

```text
Researcher / Participant browser
        |
        v
Vercel — Next.js application
        |
        v
Supabase
  - Auth
  - Postgres / RLS / RPC / triggers
  - Edge Functions
  - private provider/deployment secrets
        |
        +----> ClawMail API
        |
        +----> Vercel REST API
```

Stable operational identifiers:

- GitHub: `stpcoder/research-align`
- canonical production source branch: `main`
- Supabase project: `rgwqsqeikebwunbdnbex`
- region: `ap-northeast-1`
- Vercel project: `research-align`
- Vercel project ID: `prj_m1b582jShPhKBRfxY8GLDxAPFrGQ`
- Vercel team ID: `team_muySkNMTu5rLXyDOd5pTz1tw`
- production URL: `https://research-align.vercel.app`

Changing deployment IDs and SHAs belong in HANDOFF rather than this file.

## 3. Application stack and source layout

Current application stack:

- Next.js 16
- React 19
- TypeScript
- `@supabase/supabase-js`

Primary current implementation surfaces:

- `src/components/ResearchHome.tsx`
- `src/components/FormBuilderUnified.tsx`
- `src/components/ResponseManagerUnified.tsx`
- `src/components/ScheduleUnified.tsx`
- `src/components/ContactManager.tsx`
- `src/components/ParticipantForm.tsx`
- `src/components/PublicInquiryWidget.tsx`
- `src/components/admin/*`
- `src/app/s/[slug]/page.tsx`
- `src/lib/researcherNavigation.ts`
- `src/lib/types.ts`
- `supabase/functions/*`
- `supabase/migrations/*`

Browser code uses only publishable Supabase configuration. Provider/deployment secrets remain server-side/private.

### Build-time source rewrite warning

`npm run dev` and `npm run build` first execute `scripts/prebuild-ui-copy.mjs`.

The script currently mutates source before Next.js runs. It swaps legacy inline implementations in `src/app/page.tsx` for Unified components and also injects current lifecycle/navigation behavior. Therefore raw `page.tsx` alone is not canonical production behavior.

This remains important technical debt: current behavior should eventually be moved into canonical source so builds do not mutate tracked files.

## 4. Authentication and tenancy

Researchers authenticate with Supabase email/password auth.

Each study has `owner_id`; RLS uses study ownership to isolate researcher data across studies, responses, assignments, contact state, notifications, and contact channels.

Study statuses are:

- `draft` — not currently public; never started or currently editable before publishing
- `published` — participant recruitment/application is open
- `closed` — recruitment explicitly stopped

Public participants can read/submit only to published studies.

## 5. Research Home / dashboard

The researcher home loads operational state across all studies owned by the current researcher and shows:

- today's scheduled sessions
- participants with incomplete scheduling
- reply-required inquiries/messages
- latest schedule-notification failures
- per-study operational counts
- upcoming sessions across studies

### Study lifecycle and deletion

Permanent study deletion exists and is protected by typing the exact study title.

Current published-study lifecycle is intentionally:

```text
published
  -> 모집 중지
  -> closed
  -> 삭제 available
```

A published study cannot be permanently deleted directly. The researcher must stop recruitment first. The home card shows `모집 중지` while published and `삭제` after it is closed. A defensive delete guard also refuses a published study even if the UI is bypassed.

Closed studies can be reopened from the workspace with `모집 재개`.

Deleting a study is a real database delete; cascading FKs remove dependent operational rows. This is not a soft-delete archive.

## 6. Form Builder

Supported field types:

- short text
- long text
- email
- phone
- radio
- checkbox
- informational text
- availability

Availability fields support:

- stable session key / label
- duration
- start interval (`stepMinutes`)
- min/max number of selectable slots
- Top-N preference ranking
- dates and operating hours
- per-slot blackout
- location
- participant instructions
- post-session buffer time

Date editing supports individual dates, 7-day addition, arbitrary ranges, single-date removal, and clear-all.

The Form Builder tracks dirty state and guards navigation/unload while changes are unsaved.

### Publish autosave behavior

`모집 시작` and `모집 재개` are save-before-publish operations.

If the mounted Form Builder is dirty:

1. the workspace invokes the Form Builder's existing save operation
2. title/slug/description/form configuration are persisted
3. the workspace waits for dirty state to clear
4. only then is study status changed to `published`

If save validation/persistence fails and dirty state remains, publishing is aborted. This prevents a researcher from clicking publish, returning home, and exposing the older saved form while assuming the latest edits were published.

Stopping recruitment does not force an unrelated form save.

## 7. Participant application flow

Public route: `/s/[slug]`.

The public page contains:

- `ParticipantForm`
- `PublicInquiryWidget`

Availability submission is a request rather than an immediate reservation. Participants fill the configured form, select/rank slots, submit, then wait for researcher scheduling.

Busy intervals come from `get_public_busy_intervals(study_id)`. The form re-fetches busy intervals immediately before submission to reject slots that became unavailable while the page was open.

## 8. Researcher participant context and navigation

Applicant details, scheduling, and participant contact share one operational participant context.

The active response ID is reflected in the researcher URL as:

`?participant=<response_id>`

`src/lib/researcherNavigation.ts` owns the small client-side navigation contract. The three participant-oriented work areas restore this URL value before falling back to their normal first/default participant selection.

Current cross-workflow actions include:

- applicant detail → `일정 조율하기`
- applicant detail → `연락하기`
- schedule → `이 참가자에게 연락`
- contact → `일정 보기`
- contact → `신청 내용`

Selecting an unmatched pre-application inquiry clears participant context so an unrelated applicant is not silently carried across.

The top-level StudyWorkspace listens for the internal `studyform:navigate` event and changes tabs without discarding the participant query parameter. This behavior is currently injected by the build-time rewrite layer and should move into canonical workspace source when that debt is removed.

## 9. Researcher-wide scheduling model

Scheduling is resource-constrained across all studies owned by the same researcher.

The UI loads researcher-visible assignments across studies. PostgreSQL independently enforces the invariant through `prevent_owner_schedule_overlap()`.

Blocking assignment states:

- `confirmed`
- `completed`
- `no_show`

`cancelled` does not block time.

Both duration and `bufferMinutes` participate in overlap calculations. The public busy RPC also includes buffer occupation.

Assignment statuses:

- `confirmed`
- `completed`
- `no_show`
- `cancelled`

Cancellation preserves the row. `(response_id, session_key)` is unique. Legacy `draft` assignment writes are normalized to `confirmed`.

The UI additionally supports configured session order, max sessions/day, participant-selected scheduling, admin-agreed direct scheduling, search/filtering, lifecycle states, and 4-date schedule-window navigation.

### Schedule action hierarchy

For an unassigned session, selecting a valid participant-provided slot creates a pending selection bar. The primary confirmation CTA explicitly states the side effect: `일정 확정하고 안내 보내기`.

For an already-confirmed session, replacement slots are not clickable by default. The researcher must first choose `시간 변경`, then select the replacement, then confirm `일정 변경하고 안내 보내기`. The current assignment remains intact until the replacement is explicitly confirmed.

For future confirmed sessions, completion/no-show actions are intentionally not prominent. `완료 처리` and `불참 처리` appear only once the session end time has passed. `일정 취소` is styled as a destructive action. If schedule email delivery failed, `안내 다시 보내기` becomes the primary recovery action.

### Participant time coordination

When participant-submitted slots do not work, the researcher uses `다른 시간 조율하기` rather than directly enabling arbitrary empty slots.

The coordination decision has two branches:

1. `이메일로 시간 협의`
   - opens Contact for the same participant
   - does not create or change an assignment
2. `이미 합의한 시간이 있음`
   - enters an explicit agreed-time selection mode
   - empty conflict-free slots become selectable
   - confirmation uses the existing `admin_agreed` scheduling source and `agreement_confirmed_at`
   - the final CTA is `합의한 시간 확정하고 안내 보내기`

Change mode, coordination options, and agreed-time mode are mutually exclusive so the researcher can see what operational mode they are in.

This is not yet a formal proposal/acceptance state machine. A future enhancement may add persisted schedule proposals and participant acceptance tracking.

## 10. Responses and participant detail

Participant management shows submitted answers, availability, preference ranks, schedule history/status, and contact state.

Current schedule labels:

- `confirmed` → 확정
- `completed` → 완료
- `no_show` → 불참
- `cancelled` → 취소

The selected participant header also provides direct workflow actions to schedule or contact that same participant.

CSV and JSON export are supported.

## 11. Public inquiry system

A participant can ask an email inquiry before applying.

Public inquiry submission validates published study state, input length/email format, and rapid duplicates, then creates/reuses a `pending` thread.

Conservative inquiry/application matching order:

1. unique exact email
2. email + name when email alone is ambiguous
3. unique normalized name

Ambiguous matches are not forced.

## 12. Contact state model and UX

Supabase tables `contact_threads` and `contact_messages` are the communication source of truth.

Thread statuses:

- `pending` — researcher response required
- `open` — conversation in progress
- `closed` — finished

Sources include `participant` and `public_inquiry`.

The contact UI prioritizes pending conversations, then recency, and supports participant/inquiry search. For a selected participant, Contact keeps the shared participant context and exposes `일정 보기` and `신청 내용` shortcuts. Automatic schedule email is recorded in conversation history but does not falsely clear a pending participant inquiry.

### Inline schedule context

A matched participant's conversation includes a compact `일정` section inside the existing conversation surface. It does **not** reproduce the full timetable.

For every availability/session field, Contact shows one plain row:

- session name
- current assignment time when assigned, otherwise a preview of the participant's submitted candidate times
- semantic status badge (`확정`, `완료`, `불참`, `미정`)

Unassigned candidate previews are sorted by submitted preference rank, show at most three concrete slots, and collapse additional slots to `+N`. Detailed conflict checking and schedule modification remain in the Schedule view.

The schedule context intentionally uses simple horizontal separation within the existing surface rather than another nested card, colored state rail, or left-edge-only highlight.

### Contact visual hierarchy

Mailbox/provider identity is secondary utility UI rather than the page's dominant state panel. When connected, the header shows the research mailbox address, useful last-sync time, and one sync action. When not connected, it shows one `연구용 이메일 연결` action.

Repeated state wording is intentionally minimized:

- pending conversations use one `답변 필요` badge instead of repeating `대기 / 답변 필요 / 새 문의`
- recipient email is shown in the participant header rather than repeated in the composer footer
- successful provider sends are surfaced as `이메일을 보냈습니다.` rather than exposing transport status text
- empty-state and source labels are short and task-oriented

Admin UI should continue to prefer spacing, typography, subtle full-surface state, and dividers over ornamental cards or a colored left edge used as the only status cue.

## 13. ClawMail email provider

ClawMail is the current email transport.

Private study mailbox material is stored in `private.clawmail_material`; the browser cannot read provider tokens. `study_contact_channels` contains non-secret channel identity.

The `clawmail` Edge Function supports status, provision, sync, and sending through an existing owned thread. Imported provider message IDs are deduplicated. The contact UI polls while connected.

Known risk: runtime testing encountered a provider daily send limit of 5. Provider capacity must be validated/upgraded before participant-scale use.

Provider failure does not roll back scheduling state.

## 14. Schedule notification subsystem

`notifications` audits schedule-mail delivery.

Kinds:

- `schedule_confirmation`
- `schedule_cancellation`

Statuses:

- `pending`
- `sent`
- `failed`
- `skipped`

`schedule-notify` handles initial confirmations, changed-time messages, cancellation messages, idempotency, missing-email skips, provider failures, and writing automatic schedule notices into contact history.

Messages can include date/time, duration, location, and participant instructions.

## 15. SMS and Google Calendar

SMS is not a current product feature. Phone remains only as a manual researcher contact field; legacy DB enum values may remain for compatibility.

Google Calendar integration was removed. Remaining `google-calendar` and `google-calendar-oauth` deployments are disabled JWT-required HTTP 410 stubs and must not be treated as active integration.

## 16. Deployment control plane

Primary production deployment is controlled from Supabase rather than relying on a normal Vercel GitHub App push integration.

```text
operator / ChatGPT
  -> GitHub source / exact intended commit
  -> deploy_control_jobs
  -> Postgres trigger + pg_net
  -> Supabase Edge Function: vercel-control
  -> source snapshot
  -> Vercel Files Deployment API
  -> persistent Vercel project
  -> deploy_control_state
```

`vercel-control` is source-controlled at:

`supabase/functions/vercel-control/index.ts`

The live function intentionally uses `verify_jwt=false` because requests are protected by a separate high-entropy private `controlKey`. Do not remove that custom authentication or expose the key.

### Source snapshot paths

There are two snapshot modes:

1. **Exact-SHA codeload mode — preferred when an exact source SHA is known**
   - manifest includes `commitSha`
   - function downloads `codeload.github.com/<repo>/tar.gz/<commitSha>`
   - archive root is normalized before upload
   - `package.json` presence is validated before a Vercel deployment is created
   - `deploy_control_state.details.snapshotSource = github-codeload`

2. **GitHub REST API mode — compatibility path**
   - used when no explicit commit SHA is supplied
   - resolves branch commit/tree/blobs through GitHub REST
   - may use private `github_token` if configured

The codeload path exists because unauthenticated GitHub REST calls from shared Supabase egress can hit low rate limits. Exact-SHA codeload avoids that shared-IP REST limit while retaining deterministic source selection for this public repository.

The initial codeload implementation exposed an archive-root parser bug (`missing_pages_app` at Vercel); the current parser uses a two-pass common-root normalization and a `package.json` guard. Live `vercel-control` is version 4 after that correction.

### Deployment acceptance

A production deployment is not accepted merely because a job was inserted. Required checks include:

- deploy job succeeds
- `deploy_control_state.status = READY`
- `details.commitSha` equals the intended exact SHA
- production URL remains `https://research-align.vercel.app`
- `snapshotSource` is recorded
- relevant behavior is tested as far as the available authenticated environment permits

The Vercel bootstrap credential was rotated; the bootstrap token is recorded as revoked and a dedicated Vercel control token is used.

### Vercel connector caveat

The top-level ChatGPT/Vercel connector may lack permission to list/inspect this team project even while the Supabase control plane is healthy. Never create a duplicate project because of connector visibility; use `deploy_control_state` first.

## 17. GitHub Actions

`.github/workflows/vercel-control.yml` is a manual fallback, not the primary deployment mechanism.

`main` currently has no required build/lint checks or branch protection. This remains a hardening task.

## 18. Edge Functions

Core operational functions:

- `vercel-control`
- `vercel-inspect`
- `clawmail`
- `schedule-notify`

Several old bootstrap/probe/removed-integration functions can still appear in the function list but intentionally return HTTP 410 and require JWT where appropriate. Function-list ACTIVE status alone therefore does not imply an active product capability; inspect function bodies.

## 19. Core database objects

Main public tables:

- `studies`
- `responses`
- `assignments`
- `contact_threads`
- `contact_messages`
- `notifications`
- `study_contact_channels`
- `researcher_profiles`
- `deploy_control_jobs`
- `deploy_control_state`

Private operational data includes:

- `private.clawmail_material`
- `private.deploy_control_secrets`
- legacy `private.keyid_material`

RLS is enabled on exposed application tables.

## 20. Production/test data state

Production still contains demo/test studies and synthetic participants. Clean this deliberately before a real participant pilot; do not delete test/demo data as an incidental side effect of unrelated feature development.

## 21. Known technical debt / hardening backlog

### High priority before real pilot

1. Validate/upgrade/replace ClawMail capacity.
2. Add CI build/lint gates and branch protection for `main`.
3. Clean production demo/test data intentionally.
4. Remove/archive unnecessary legacy/probe infrastructure after dependency review.

### UX follow-up

1. Run an authenticated visual/click audit of participant-centered Applicant → Schedule → Contact workflows when a researcher session is available.
2. Add further coordination UI only when it removes a demonstrated workflow gap; avoid duplicating schedule state or explanatory copy across surfaces.
3. Consider persisted schedule proposals (`proposed -> confirmed`) only if real researcher/participant negotiation needs explicit acceptance tracking.
4. Review whether participant context should eventually be represented in route structure rather than only a query parameter.

### Code maintainability

1. Remove `scripts/prebuild-ui-copy.mjs` source rewriting and make current UI source canonical.
2. Reconcile stale KeyID-era README/config and `SOURCE_MANIFEST.json`.
3. Simplify legacy enum/provider states when compatibility is no longer needed.

### Database/security/performance

1. Minimize unnecessary anonymous EXECUTE grants such as `create_demo_study()`.
2. Keep intentionally public SECURITY DEFINER RPCs narrowly scoped.
3. Consider Supabase leaked-password protection.
4. Add useful indexes including `contact_threads.response_id`, `notifications.response_id`, and `studies.owner_id` as scale requires.

## 22. Definition of a production-ready change

A production behavior change is complete only when all applicable layers are known:

- source committed to GitHub
- each meaningful source change recorded in `CHANGE_LEDGER`
- DB migration/function state applied and verified if relevant
- Edge Function version/auth state verified if relevant
- Next/Vercel build succeeds
- intended production deployment is READY
- deployed commit equals the intended source commit
- relevant researcher/participant behavior is tested at the real boundary when an authenticated environment is available
- unperformed tests are explicitly recorded rather than implied
- temporary infrastructure/probes are disabled or cleaned up
- HANDOFF and DEVELOPMENT_LOG are updated
