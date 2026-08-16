# AGENTS.md — Research Align Development Rules

This file is the durable operating contract for any AI agent or developer working on this repository.

## 1. Start every development session here

Before changing code, read these files in order:

1. `AGENTS.md` — durable rules and workflow.
2. `docs/HANDOFF.md` — the latest session state, unfinished work, and immediate next steps.
3. `docs/PROJECT_STATE.md` — current architecture, production topology, data model, and implemented feature inventory.
4. `docs/DEVELOPMENT_LOG.md` — chronological history when prior decisions or regressions matter.
5. `docs/ADMIN_DESIGN_SYSTEM.md` — required when changing the researcher/admin UI.
6. `deploy-control/README.md` — required when changing or diagnosing deployment infrastructure.

Do not infer the current state from an old conversation, README prose, or a remembered commit. Verify GitHub `main` and live Supabase/Vercel state before consequential changes.

## 2. Sources of truth

Use this priority order when sources disagree:

1. Live Supabase production schema, migrations, functions, RLS, Edge Functions, and `deploy_control_state`.
2. Current GitHub `main` source.
3. Current production deployment metadata.
4. `docs/PROJECT_STATE.md` and `docs/HANDOFF.md`.
5. `README.md` and `SOURCE_MANIFEST.json`.

`README.md` and `SOURCE_MANIFEST.json` contain legacy KeyID-era information and must not be treated as authoritative without verification.

## 3. Current production identity

These identifiers are operational references, not secrets:

- Repository: `stpcoder/research-align`
- Default/source branch: `main`
- Supabase project: `rgwqsqeikebwunbdnbex`
- Supabase region: `ap-northeast-1`
- Vercel project: `research-align`
- Vercel project ID: `prj_m1b582jShPhKBRfxY8GLDxAPFrGQ`
- Vercel team ID: `team_muySkNMTu5rLXyDOd5pTz1tw`
- Canonical production URL: `https://research-align.vercel.app`

The exact current Git commit and deployment ID are intentionally kept in `docs/HANDOFF.md`, because they change every session.

## 4. Critical architecture rule: deployment is not normal GitHub-to-Vercel auto-deploy

The primary deployment path is:

```text
GitHub main
  -> Supabase deploy_control_jobs
  -> Postgres trigger / pg_net
  -> Supabase Edge Function: vercel-control
  -> GitHub repository snapshot
  -> Vercel Files Deployment API
  -> persistent Vercel production project
  -> deploy_control_state
```

GitHub Actions in `.github/workflows/vercel-control.yml` are a manual fallback only.

The top-level Vercel connector may fail to list the project even while production is healthy. Never create a replacement Vercel project merely because a connector returns an empty project list. First inspect `public.deploy_control_state` in Supabase.

After every production deployment, verify all of the following:

- `deploy_control_state.status = 'READY'`
- `deploy_control_state.details.commitSha` equals the intended GitHub `main` SHA
- `production_url` remains `https://research-align.vercel.app`
- public participant routes still respond successfully

## 5. Critical source-code rule: build-time rewrite exists

`package.json` runs `scripts/prebuild-ui-copy.mjs` before both `next dev` and `next build`.

That script rewrites parts of `src/app/page.tsx` at build time and swaps the legacy inline implementations for:

- `ResearchHome`
- `FormBuilderUnified`
- `ResponseManagerUnified`
- `ScheduleUnified`
- `ContactManager`

It also patches UI copy and unsaved-change navigation behavior.

Therefore:

- Do not judge production behavior by reading `src/app/page.tsx` alone.
- Prefer editing the Unified components for current functionality.
- Before changing `page.tsx`, inspect `scripts/prebuild-ui-copy.mjs` and determine whether the build will overwrite the change.
- Long term, removing this rewrite layer is desirable, but do not casually remove it without replacing all behavior it currently injects.

## 6. Database and scheduling invariants

Scheduling correctness is enforced in both UI and PostgreSQL. Do not weaken database-level invariants just to make the frontend pass.

Important current rules:

- A researcher may own multiple studies.
- Confirmed resource occupancy is owner-wide across all of that researcher's studies.
- Assignment statuses are `confirmed`, `completed`, `no_show`, and `cancelled`.
- Cancellation preserves the assignment row; it is not a delete.
- `(response_id, session_key)` is unique.
- Session duration and `bufferMinutes` participate in overlap checks.
- `confirmed`, `completed`, and `no_show` assignments occupy time; `cancelled` does not.
- Public participant busy intervals are owner-wide, not study-local.
- Participant submission re-fetches busy intervals before insert to reduce stale-page races.
- Session order and `maxSessionsPerDay` are enforced in the scheduling UI.

When changing scheduling behavior, inspect and update as necessary:

- `src/components/ScheduleUnified.tsx`
- `src/components/ParticipantForm.tsx`
- `supabase/migrations/*schedule*`
- live `prevent_owner_schedule_overlap()`
- live `get_public_busy_intervals()`

A scheduling feature is not complete until the database-side behavior has been verified.

## 7. Contact and email architecture

Supabase is the application source of truth for communication state:

- `contact_threads`
- `contact_messages`
- `notifications`
- `study_contact_channels`

ClawMail is the current email transport/provider. Provider credentials live in the private Supabase schema and must never be exposed to the browser or committed to GitHub.

Current contact thread states:

- `pending` = researcher response required
- `open` = in progress
- `closed` = finished

Automatic schedule emails must not incorrectly clear an existing participant inquiry from `pending`.

Schedule notification kinds are:

- `schedule_confirmation`
- `schedule_cancellation`

Notification delivery failure must not roll back the underlying schedule state. Persist the schedule change, record notification failure, and expose retry/attention state to the researcher.

Do not introduce Gmail as an implicit dependency. The current production email path is ClawMail unless an explicit architecture decision changes it.

## 8. Public inquiry behavior

The public study page includes both participant application and pre-application inquiry flows.

Inquiry/applicant matching currently prefers:

1. unique exact email
2. email + name when email is non-unique
3. unique name

Avoid unsafe fuzzy matching that could attach one person's inquiry to another participant.

## 9. Security rules

- Never commit service-role keys, provider API tokens, deployment control keys, webhook tokens, private seeds, or other secrets.
- Browser code may use only Supabase publishable/public configuration.
- Preserve RLS on exposed application tables.
- Keep private provider material in non-exposed/private storage.
- Treat `SECURITY DEFINER` functions as privileged APIs and review grants explicitly.
- Test/probe Edge Functions must be removed or returned to `verify_jwt=true` + HTTP 410 disabled stubs after use.
- Do not expose deployment-control secret values in logs, docs, commits, or chat handoffs.

## 10. Development workflow

For each meaningful change:

1. Read the current handoff and verify live baseline.
2. Inspect the smallest relevant code/data surface before editing.
3. Implement the change in GitHub source.
4. If schema/function behavior changes, create and commit a migration and apply/verify it in the live Supabase project.
5. Run relevant build/type/lint checks where available.
6. Deploy using the established Supabase/Vercel control plane when production deployment is intended.
7. Verify production behavior, not only build success.
8. Update documentation before ending the session.

Avoid broad unrelated refactors while fixing an operational bug unless the refactor is necessary for correctness.

## 11. Required end-of-session protocol

Before ending any development session, do all of the following:

### Update `docs/HANDOFF.md`
Replace it with the latest state. It must contain:

- timestamp in KST
- current GitHub `main` HEAD
- current production deployment ID/status/commit
- exactly what changed this session
- database migrations/functions changed
- Edge Functions changed
- tests/E2E checks actually performed and their result
- unresolved bugs or risks
- immediate next tasks, in priority order
- any temporary infrastructure created and whether it was disabled/removed

### Append `docs/DEVELOPMENT_LOG.md`
Add a short dated session entry. This file is append-only history; do not rewrite old entries merely to make the narrative cleaner.

### Update `docs/PROJECT_STATE.md` when architecture changes
Only change it when the durable product/architecture state changed. Do not use it as a minute-by-minute log.

## 12. Recommended prompt for a new chat session

Use a prompt like:

> Continue development of `stpcoder/research-align`. First read `AGENTS.md`, `docs/HANDOFF.md`, and `docs/PROJECT_STATE.md` from `main`. Treat them as the handoff, but verify the current GitHub HEAD and live Supabase `deploy_control_state` before making changes. Then continue from the `Next tasks` section in `docs/HANDOFF.md`. At the end, update the handoff and development log.

If the new task is specifically UI work, add `docs/ADMIN_DESIGN_SYSTEM.md` to the required reading list.

## 13. Current technical debt to remember

These are known cleanup/hardening areas, not necessarily the next feature to build:

- remove the build-time `page.tsx` rewrite and make canonical source explicit
- resolve/upgrade ClawMail production sending quota before real participant scale
- add CI / branch protection for `main`
- clean legacy KeyID / Google Calendar / probe artifacts and stale documentation
- review Supabase advisor findings and add useful indexes
- minimize unnecessary `SECURITY DEFINER` grants, including anonymous execution where not required
- clean production demo/test data before a real pilot

Always prefer correctness and recoverability over hiding operational failures.