# Research Align — Current Project State

Last architecture review: 2026-08-16 KST

This document describes the durable current state of the product and infrastructure. It is not a session log. For the latest commit/deployment and unfinished work, read `docs/HANDOFF.md`.

## 1. Product purpose

Research Align / StudyForm is a researcher-operated workspace for human-subject study operations. A researcher can own and run multiple studies from one account, including:

- participant-facing application forms
- availability collection and preference ranking
- scheduling across multiple sessions
- researcher-wide conflict prevention across multiple studies
- participant lifecycle tracking
- participant and pre-application inquiry management
- schedule confirmation/change/cancellation email
- operational dashboard and failure attention states

The core design principle is that research operations live in one system instead of being split across forms, spreadsheets, calendars, and ad-hoc email threads.

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
  - Postgres
  - RLS
  - RPC / triggers
  - Edge Functions
  - private provider/deployment secrets
        |
        +----> ClawMail API (email transport)
        |
        +----> Vercel REST API (deployment control plane)
```

Operational identifiers:

- GitHub repository: `stpcoder/research-align`
- Source branch: `main`
- Supabase project: `rgwqsqeikebwunbdnbex`
- Supabase region: `ap-northeast-1`
- Vercel project name: `research-align`
- Vercel project ID: `prj_m1b582jShPhKBRfxY8GLDxAPFrGQ`
- Vercel team ID: `team_muySkNMTu5rLXyDOd5pTz1tw`
- Production URL: `https://research-align.vercel.app`

## 3. Application stack

Current repository dependencies are centered on:

- Next.js 16
- React 19
- TypeScript
- `@supabase/supabase-js`

The browser uses Supabase publishable configuration only. Server/provider secrets must remain outside browser bundles.

## 4. Important source layout

Current feature implementation is primarily in:

- `src/components/ResearchHome.tsx`
- `src/components/FormBuilderUnified.tsx`
- `src/components/ResponseManagerUnified.tsx`
- `src/components/ScheduleUnified.tsx`
- `src/components/ContactManager.tsx`
- `src/components/ParticipantForm.tsx`
- `src/components/PublicInquiryWidget.tsx`
- `src/components/admin/*`
- `src/app/s/[slug]/page.tsx`
- `src/lib/types.ts`
- `supabase/functions/*`
- `supabase/migrations/*`

### Build-time rewrite warning

`npm run dev` and `npm run build` first execute `scripts/prebuild-ui-copy.mjs`.

That script mutates `src/app/page.tsx` and swaps legacy inline components for the current Unified implementations. It also injects current Korean UI copy and unsaved-change navigation handling.

As a result, `src/app/page.tsx` by itself is not a reliable representation of production behavior. This is known technical debt and should eventually be replaced by canonical source without mutation-at-build.

## 5. Authentication and tenancy

Researchers authenticate with Supabase email/password auth.

Each `studies` row has an `owner_id`. RLS policies use study ownership to isolate researcher data across:

- studies
- responses
- assignments
- contact threads/messages
- notifications
- study contact channels

A researcher is an administrator of their own tenant; there is no normal shared global admin account.

Study states are:

- `draft`
- `published`
- `closed`

Public participants may read only published studies and submit responses only to published studies.

## 6. Dashboard / Research Home

The researcher home page is an operations dashboard rather than a simple study list.

It loads data across all studies owned by the current researcher and displays:

- today's scheduled sessions
- participants with incomplete scheduling
- inquiries/messages requiring a researcher reply
- latest schedule-notification failures
- per-study versions of the same metrics
- upcoming sessions across all studies

The dashboard's email failure count is based on the latest notification state per assignment/kind so a successful retry can clear the attention state.

Study deletion is currently a permanent deletion flow protected by typing the exact study title. Cascading foreign keys remove dependent operational records.

## 7. Form Builder

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

- stable session key
- session label
- duration
- start interval (`stepMinutes`)
- minimum/maximum number of selectable slots
- Top-N preference ranking
- selected dates
- operating hours
- per-slot blackout configuration
- location
- participant instructions/preparation notes
- post-session buffer time

Date management supports:

- individual date addition
- 7-day addition
- arbitrary start/end range addition
- remove one date
- clear dates

Unsaved-change state is displayed and browser/tab navigation is guarded by the current build-time patching layer.

## 8. Participant application flow

Public route:

`/s/[slug]`

The page contains both:

- `ParticipantForm`
- `PublicInquiryWidget`

Availability submission is a request, not an immediate reservation.

The participant:

1. fills configured form fields
2. selects available slots
3. optionally ranks preferred slots
4. submits a response
5. waits for the researcher to assign/confirm the actual session

Busy intervals are fetched from `get_public_busy_intervals(study_id)`.

The form re-fetches busy intervals immediately before submission and rejects selections that became unavailable while the page was open.

## 9. Researcher-wide scheduling model

Scheduling is intentionally resource-constrained across all studies owned by one researcher.

A researcher cannot confirm overlapping sessions in two different studies.

The UI loads all assignments visible to the researcher and distinguishes:

- current assignment
- current study assignments
- another study's assignments
- another participant's selected availability
- buffer occupation

The database independently enforces the same owner-wide invariant using `prevent_owner_schedule_overlap()`.

### Time occupation

Current blocking assignment states:

- `confirmed`
- `completed`
- `no_show`

`cancelled` does not block time.

Both session duration and configured `bufferMinutes` participate in conflict detection.

The public busy-interval RPC also extends the busy interval through the configured buffer.

### Assignment state model

Allowed assignment statuses:

- `confirmed`
- `completed`
- `no_show`
- `cancelled`

A compatibility normalization function converts legacy `draft` writes to `confirmed`.

`(response_id, session_key)` is unique.

Cancellation preserves the assignment row for audit/history.

### Additional schedule rules

The current UI also supports:

- configured session order
- maximum sessions per participant per day
- participant-selected scheduling
- explicit researcher/admin-agreed scheduling for a time not originally selected by the participant
- participant search
- participant lifecycle filter
- 4-date scheduling window navigation

Participant lifecycle presentation distinguishes roughly:

- unscheduled
- partially scheduled
- fully scheduled
- all sessions handled

## 10. Responses / participant detail

The participant-management screen shows:

- submitted answers
- selected availability
- preference ranks
- schedule history
- schedule status badges
- contact thread history/status

Current schedule display labels:

- `confirmed` → 확정
- `completed` → 완료
- `no_show` → 불참
- `cancelled` → 취소

The screen supports CSV and JSON export.

## 11. Public inquiry system

A participant can submit an email inquiry before applying to the study.

The public RPC validates that the study is published, validates input length/email format, rate-limits rapid duplicate inquiry messages, creates/reuses a thread, and marks it `pending`.

When possible, inquiries are associated with an existing or later-created participant response using conservative matching:

1. unique exact email
2. email + name when email is ambiguous
3. unique normalized name

Ambiguous matches are not forced.

## 12. Contact state model

Supabase is the application source of truth for communication state.

Key tables:

- `contact_threads`
- `contact_messages`

Thread statuses:

- `pending` — researcher response required
- `open` — conversation in progress
- `closed` — finished

Sources:

- `participant`
- `public_inquiry`

The contact UI prioritizes `pending` conversations, then recency, and supports participant/inquiry search.

Automatic schedule messages are labeled in the conversation as automatic schedule notices.

An automatic schedule email does not count as a researcher reply to a pending participant inquiry; an existing `pending` state must remain pending unless the researcher actually handles it.

## 13. ClawMail email provider

ClawMail is the current production email transport.

Study-specific material is stored in the private Supabase table:

`private.clawmail_material`

Stored private values include provider inbox identity, address, and API token. Browser clients cannot read this table.

`study_contact_channels` stores the non-secret public-facing channel identity.

The `clawmail` Edge Function currently supports:

- status
- provision a research inbox
- sync inbox
- send a message through an existing owned thread

The contact UI polls for new mail while connected, currently on an approximately 60-second interval.

Provider message IDs are de-duplicated when importing.

### Known provider risk

E2E testing encountered a runtime error indicating a daily send limit of 5 even though public provider materials described a larger free-tier limit. Provider quota/capacity must be validated or upgraded before real participant-scale operation.

Provider failure is treated as an email-delivery failure, not a scheduling transaction failure.

## 14. Schedule notification subsystem

Schedule email delivery has a separate audit table:

`notifications`

Current notification kinds:

- `schedule_confirmation`
- `schedule_cancellation`

Current notification statuses:

- `pending`
- `sent`
- `failed`
- `skipped`

`schedule-notify` handles:

- initial confirmation mail
- changed-time mail
- cancellation mail
- idempotency for an already-sent identical assignment time snapshot
- missing-email skip state
- provider failure logging
- writing automatic schedule mail into the contact conversation history

Schedule messages may include:

- session date/time
- duration
- location
- participant instructions

The assignment change is saved even when notification delivery fails.

## 15. SMS and legacy communication fields

SMS is not a current product feature.

New/default forms no longer ask the participant to choose email vs SMS. Existing study form configuration was migrated to remove SMS-related copy. Phone is retained only as a manual researcher contact number.

Some database enums still retain legacy `sms`, `phone`, `keyid`, or `manual` values for compatibility. Their existence does not mean the current UI supports those providers/channels.

## 16. Google Calendar status

Google Calendar integration was experimented with and then removed.

Edge Functions named `google-calendar` and `google-calendar-oauth` may still appear in the Supabase function list, but their current implementation is a JWT-required HTTP 410 disabled stub.

Do not treat them as active integrations.

## 17. Deployment control plane

Primary production deployment is controlled from Supabase rather than relying on Vercel's GitHub App.

Architecture:

```text
ChatGPT / operator
  -> GitHub main source
  -> insert apply-project job into deploy_control_jobs
  -> database trigger dispatches via pg_net
  -> vercel-control Edge Function
  -> fetches GitHub tree/blob snapshot
  -> creates/updates persistent Vercel project
  -> uploads source via Vercel Files Deployment API
  -> waits for build state
  -> records deploy_control_state
```

The Vercel bootstrap credential was rotated; the bootstrap token is recorded as revoked and a dedicated control token is used.

No secret values should be copied from the private deployment secret store.

### Vercel connector caveat

The ChatGPT/Vercel connector can show an empty project list even though the persistent production project is healthy. The Supabase control plane has the authoritative operational credential/scope.

Never create a duplicate Vercel project based only on connector visibility.

## 18. GitHub Actions status

`.github/workflows/vercel-control.yml` is a manual fallback.

It is not the primary push-triggered deployment mechanism.

The `main` branch currently has no required checks/branch protection. Adding build/lint gates and branch protection is a known hardening task before higher-stakes operation.

## 19. Edge Functions: active vs disabled

Core operational functions include:

- `vercel-control`
- `vercel-inspect`
- `clawmail`
- `schedule-notify`

Several experimental/bootstrap/probe functions remain listed as active deployments but intentionally return HTTP 410 and require JWT where appropriate, including examples such as:

- `bootstrap-research-align`
- `direct-prod-deploy`
- `ops-cancel-probe`
- `range-delete-deploy-probe`
- removed Google Calendar functions

Function-list status alone is therefore insufficient; inspect the current function body before assuming a function is operational.

## 20. Core database objects

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

Private data includes:

- `private.clawmail_material`
- `private.deploy_control_secrets`
- legacy `private.keyid_material`

RLS is enabled on exposed application tables.

## 21. Known production/test data state

The production database currently contains demo/test studies and synthetic participants. It should not yet be treated as a clean real-pilot database.

Before a real participant pilot, explicitly decide which demo records to retain and clean the rest rather than deleting data casually during unrelated feature development.

## 22. Known technical debt and hardening backlog

### High priority before a real pilot

1. Validate/upgrade/replace ClawMail capacity so expected study mail volume is supported.
2. Add CI build/lint checks and branch protection for `main`.
3. Clean production demo/test data intentionally.
4. Remove or archive unnecessary probe/legacy infrastructure after confirming no dependency remains.

### Code maintainability

1. Remove build-time source rewrite in `scripts/prebuild-ui-copy.mjs` and make the Unified components canonical directly.
2. Remove stale KeyID-era documentation/configuration and regenerate/update `SOURCE_MANIFEST.json` if it remains useful.
3. Simplify legacy enum/provider states when backwards compatibility is no longer required.

### Database/security/performance

1. Review anonymous EXECUTE privilege on `create_demo_study()`; the function currently fails without an authenticated `auth.uid()`, but the grant should still be minimized.
2. Keep intentionally public SECURITY DEFINER RPCs narrowly scoped and reviewed.
3. Consider enabling Supabase leaked-password protection.
4. Add useful indexes for current unindexed foreign keys, including `contact_threads.response_id`, `notifications.response_id`, and `studies.owner_id` as scale requires.

## 23. Definition of production-ready change

A change that affects production behavior is complete only when all applicable layers are verified:

- source committed to GitHub
- migration/function schema applied if needed
- frontend/server build succeeds
- intended production deployment reaches READY
- deployed commit matches intended source commit
- participant/researcher behavior is tested at the real production boundary
- provider failure behavior remains recoverable
- temporary test infrastructure is disabled/removed
- `docs/HANDOFF.md` and `docs/DEVELOPMENT_LOG.md` are updated
