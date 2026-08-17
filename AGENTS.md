# AGENTS.md — Research Align Development Contract

This repository is designed to be developed across many short AI/developer sessions. The repository, not chat history, is the durable memory.

## 1. Mandatory session startup

Before changing anything, read in this order:

1. `AGENTS.md` — durable rules.
2. `docs/HANDOFF.md` — exact latest operational state and active work.
3. `docs/PROJECT_STATE.md` — durable architecture and implemented feature inventory.
4. `docs/SESSION_PROTOCOL.md` — exact start/work/commit/deploy/handoff procedure.
5. `docs/CHANGE_LEDGER.md` — one entry per meaningful logical modification.
6. `docs/DEVELOPMENT_LOG.md` — prior session-level decisions/regressions when relevant.
7. `docs/ADMIN_DESIGN_SYSTEM.md` — mandatory for researcher/admin UI work.
8. `deploy-control/README.md` — mandatory for deployment/control-plane work.

Then verify live state. Never assume an old handoff SHA is still current.

## 2. Source-of-truth order

When sources disagree, use this order:

1. Live Supabase production schema, migration history, functions, RLS, Edge Functions, and `deploy_control_state`.
2. Current GitHub branch/commit being worked on; `main` is canonical production source.
3. Current production deployment metadata.
4. `docs/HANDOFF.md`, `docs/PROJECT_STATE.md`, and `docs/CHANGE_LEDGER.md`.
5. `README.md` and `SOURCE_MANIFEST.json`.

`README.md` and `SOURCE_MANIFEST.json` contain legacy KeyID-era material and are not authoritative unless verified.

## 3. Stable production identifiers

These are references, not secrets:

- Repository: `stpcoder/research-align`
- Production source branch: `main`
- Supabase project: `rgwqsqeikebwunbdnbex`
- Supabase region: `ap-northeast-1`
- Vercel project: `research-align`
- Vercel project ID: `prj_m1b582jShPhKBRfxY8GLDxAPFrGQ`
- Vercel team ID: `team_muySkNMTu5rLXyDOd5pTz1tw`
- Canonical production URL: `https://research-align.vercel.app`

Changing SHAs, deployment IDs, active branch, and in-progress work belong in `docs/HANDOFF.md`.

## 4. Deployment architecture — do not replace it casually

Primary production path:

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

`.github/workflows/vercel-control.yml` is a manual fallback only.

The top-level Vercel connector may show no projects even while production is healthy. Never create a replacement project because of connector visibility. Query Supabase `public.deploy_control_state` first.

After a production deployment verify:

- `deploy_control_state.status = 'READY'`
- `deploy_control_state.details.commitSha` equals the intended runtime commit
- `production_url = https://research-align.vercel.app`
- the relevant public/admin production flow actually works

## 5. Build-time source rewrite warning

`package.json` runs `scripts/prebuild-ui-copy.mjs` before `next dev` and `next build`.

The script rewrites parts of `src/app/page.tsx` and substitutes current implementations:

- `ResearchHome`
- `FormBuilderUnified`
- `ResponseManagerUnified`
- `ScheduleUnified`
- `ContactManager`

It also injects copy and unsaved-change navigation behavior.

Therefore:

- Do not treat `src/app/page.tsx` alone as canonical runtime behavior.
- Prefer the Unified components for current behavior.
- Inspect `scripts/prebuild-ui-copy.mjs` before editing `page.tsx`.
- Removing this rewrite is desirable technical debt, but only with full behavior parity and explicit testing.

## 6. Commit and granular change-record discipline — mandatory

The purpose is to make every completed change recoverable from GitHub even if the conversation ends immediately afterward.

### One logical change per source commit

A source commit should answer one sentence: “this commit does X.”

Good examples:

- `fix(schedule): preserve pending inquiry after auto notice`
- `feat(form): add session preparation instructions`
- `db(schedule): make overlap trigger buffer-aware`
- `ops(mail): disable temporary quota probe`

Do not mix unrelated UI cleanup, database hardening, and email changes in one source commit.

### One logical change may span many files

If one feature requires component + type + migration + Edge Function changes, those files should normally be one atomic source commit. Do not fragment a single logical feature into arbitrary per-file commits merely because an API edits files one at a time. Use local git or GitHub tree/commit APIs when necessary.

### Commit completed checkpoints promptly

Do not keep hours of already-working changes only in an ephemeral working tree. Once a logical checkpoint is implemented and verified enough to stand on its own, commit it before starting the next independent change.

Do not commit broken/WIP code to `main` solely as a backup. For larger or risky work, use a work branch.

### Every meaningful source change gets one `CHANGE_LEDGER` entry

After creating a meaningful source commit, and **before starting the next independent logical change**:

1. prepend one entry to `docs/CHANGE_LEDGER.md`
2. reference the exact source commit SHA
3. describe exact behavior changed and files/DB/functions touched
4. record current DB/Edge/deployment/verification status
5. commit the ledger bookkeeping, usually as `docs(ledger): record <short-change>`

Later migration/deployment/E2E results for that same logical change should update the same ledger entry before handoff.

Pure `docs(ledger): ...` and final `docs(handoff): ...` bookkeeping commits do **not** need their own ledger entries; otherwise logging would recurse forever.

`docs/DEVELOPMENT_LOG.md` is still required, but it is session-level narrative. `docs/CHANGE_LEDGER.md` is the granular one-change-at-a-time record.

### Branch rule

Use direct `main` commits only for small, self-contained, verified changes.

For multi-step features, refactors, risky migrations, or work likely to cross a conversation boundary:

- create `work/YYYYMMDD-<short-topic>`
- commit each verified logical checkpoint there
- record each source commit in `docs/CHANGE_LEDGER.md`
- record `active_branch` and `last_verified_commit` in `docs/HANDOFF.md`
- continue the same branch in the next session
- merge/fast-forward to `main` only after the complete change passes required checks
- production deployments use canonical `main` unless the deployment architecture is deliberately changed

### Commit message convention

Prefer:

- `feat(scope): ...` — user-visible capability
- `fix(scope): ...` — bug fix
- `db(scope): ...` — database-only/invariant change
- `ops(scope): ...` — deployment/provider/operations
- `refactor(scope): ...` — behavior-preserving structural change
- `test(scope): ...` — test coverage/probes without product behavior change
- `docs(ledger): ...` — granular ledger bookkeeping
- `docs(handoff): ...` — final session handoff/log bookkeeping
- `docs(scope): ...` — other documentation
- `chore(scope): ...` — maintenance that fits none above

### Final handoff is its own commit

After runtime work is finished and verified, update `docs/HANDOFF.md` and `docs/DEVELOPMENT_LOG.md` in a final documentation commit such as:

`docs(handoff): record <topic> completion`

This intentionally may make GitHub `main` one docs-only commit ahead of the deployed runtime SHA. Record that fact explicitly.

## 7. Database change discipline

Scheduling and contact correctness live partly in PostgreSQL. Never make frontend-only changes that weaken production invariants.

For a schema/function change:

1. Write/commit the migration in GitHub with the code that depends on it, or use an explicit staged rollout.
2. Create/update the corresponding `CHANGE_LEDGER` entry.
3. Apply it to the live Supabase project when production rollout is intended.
4. Verify the live definition/constraint/RLS/function after application.
5. Update that same ledger entry with applied/verified state.
6. Record the exact migration name in `docs/HANDOFF.md`.

For breaking database changes, prefer expand/deploy/contract:

1. backward-compatible expand migration
2. deploy application using the new shape
3. verify production
4. contract/remove legacy shape only afterward

Do not create an untracked live DDL change and leave GitHub migrations behind.

## 8. Scheduling invariants

Current rules:

- one researcher may own many studies
- occupied time is owner-wide across those studies
- assignment statuses: `confirmed`, `completed`, `no_show`, `cancelled`
- cancellation preserves the row
- `(response_id, session_key)` is unique
- duration and `bufferMinutes` participate in conflict checks
- `confirmed`, `completed`, and `no_show` occupy time; `cancelled` does not
- public busy intervals are owner-wide
- participant submit re-fetches busy intervals
- UI also enforces session order and `maxSessionsPerDay`

When touching scheduling inspect as relevant:

- `src/components/ScheduleUnified.tsx`
- `src/components/ParticipantForm.tsx`
- `supabase/migrations/*schedule*`
- live `prevent_owner_schedule_overlap()`
- live `get_public_busy_intervals()`

A scheduling change is incomplete until DB-side behavior is verified.

## 9. Contact/email invariants

Supabase is the communication state source of truth:

- `contact_threads`
- `contact_messages`
- `notifications`
- `study_contact_channels`

ClawMail is the current transport. Provider credentials stay private/server-side.

Thread states:

- `pending` = researcher response required
- `open` = in progress
- `closed` = finished

Automatic schedule email must not clear an existing `pending` inquiry.

Notification kinds:

- `schedule_confirmation`
- `schedule_cancellation`

Provider failure must not roll back schedule state. Persist schedule state, record notification failure, and expose retry/attention state.

Do not introduce Gmail as an implicit dependency.

## 10. Public inquiry matching

Matching order:

1. unique exact email
2. email + name if email is non-unique
3. unique name

Do not introduce broad fuzzy matching that may attach one person's inquiry to another participant.

## 11. Security rules

- Never commit service-role keys, provider tokens, deploy-control keys, webhook tokens, private seeds, or secrets.
- Browser code may use only publishable/public configuration.
- Preserve RLS on exposed tables.
- Keep provider material in private/non-exposed storage.
- Treat `SECURITY DEFINER` functions as privileged APIs; review grants explicitly.
- Temporary/probe Edge Functions must be removed or returned to `verify_jwt=true` + HTTP 410 stubs after use.
- Never include secret values in logs, docs, commits, or handoffs.

## 12. Work execution protocol

Follow `docs/SESSION_PROTOCOL.md`. At minimum for each meaningful work item:

1. verify baseline
2. define scope and invariant impact
3. implement smallest coherent change
4. run relevant checks
5. commit the verified logical source change
6. write and commit its `docs/CHANGE_LEDGER.md` entry
7. apply/verify DB or Edge Function changes as applicable and update the same ledger entry
8. deploy only when intended and update the same ledger entry
9. verify production behavior
10. record exact final state in handoff/log

Avoid unrelated refactors during operational fixes unless required for correctness.

## 13. Required end-of-session protocol

Before ending a development session:

### Reconcile `docs/CHANGE_LEDGER.md`

- every meaningful source commit created this session must have exactly one corresponding ledger entry
- each entry must reference the exact source commit SHA
- DB/Edge/deployment/verification fields must reflect the latest known state
- missing ledger entries must be reconstructed before handoff

### Replace `docs/HANDOFF.md`

Use `docs/HANDOFF_TEMPLATE.md` and include:

- KST timestamp
- `active_branch`
- work status: `clean`, `in_progress`, or `blocked`
- current GitHub `main` HEAD
- active branch HEAD if different
- last verified logical commit
- deployed runtime commit
- production deployment ID/status
- exact source commits created this session
- exact `CHANGE_LEDGER` entry IDs created/updated this session
- files/areas changed
- migrations/functions/Edge Functions changed
- tests/E2E actually run and results
- unresolved risks/bugs
- immediate next action
- temporary infrastructure status
- explicit statement of any source/DB/deployment drift

### Append `docs/DEVELOPMENT_LOG.md`

Add a factual dated session-level entry. Never rewrite old entries simply for narrative cleanup.

### Update `docs/PROJECT_STATE.md` only for durable architecture/product-state changes

Do not turn it into a session log.

### Commit the handoff

The final session documentation must itself be committed so the next conversation can retrieve it from GitHub.

## 14. Recovery after an interrupted session

If a previous conversation ended unexpectedly:

1. Read `docs/HANDOFF.md` but do not assume it captured the very last action.
2. Inspect commits after the handoff's recorded `main_head` / `last_verified_commit`.
3. Read `docs/CHANGE_LEDGER.md` and compare entries with meaningful source commits.
4. If a meaningful source commit exists without a ledger entry, reconstruct that entry before starting new independent work.
5. If a work branch is recorded, inspect that branch before creating a new one.
6. Query live Supabase migration history and `deploy_control_state`.
7. Distinguish four states explicitly: source committed, DB applied, Edge Function deployed, Vercel runtime deployed.
8. Continue from the newest verified checkpoint; do not redo already-committed work blindly.
9. If an unverified commit exists, inspect/test it before building on it.

## 15. Known technical debt

- remove build-time `page.tsx` rewrite and make canonical source explicit
- resolve ClawMail production sending quota before participant scale
- add CI / branch protection for `main`
- clean legacy KeyID / Google Calendar / probe artifacts and stale docs
- review Supabase advisor findings and useful indexes
- minimize unnecessary `SECURITY DEFINER` grants
- clean demo/test production data before real pilot

Prefer recoverability and correctness over hiding operational failures.
