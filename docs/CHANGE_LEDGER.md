# Research Align — Granular Change Ledger

This file is the append-only ledger of individual meaningful changes made to Research Align.

It exists for cross-session recovery. A new conversation should be able to answer not only “what happened this session?” but “what exactly changed, one logical change at a time?”

## Rules

1. **One meaningful logical change = one ledger entry.**
   - feature
   - bug fix
   - database/invariant change
   - Edge Function/provider change
   - deployment/operations change
   - non-trivial refactor
   - security hardening
   - important developer-protocol change
2. Record an entry **after the logical source commit is created and before starting the next independent change**.
3. Every entry must reference the exact source commit SHA it describes.
4. After adding the ledger entry, commit the ledger bookkeeping before beginning the next independent logical change.
5. If the change later gets deployed, migrated, or further verified, update the same entry with the resulting deployment/migration/verification state before session handoff.
6. Never silently delete old entries. Corrections should explain what was corrected.
7. Pure `docs(ledger): ...` and final `docs(handoff): ...` bookkeeping commits are exempt from getting their own ledger entry; otherwise logging would recurse forever.
8. Tiny mechanical edits that are inseparable from one logical change belong inside that change's single entry, not separate entries for every line edit.
9. `docs/DEVELOPMENT_LOG.md` remains the session-level narrative. This file is the **per-change ledger**.

## Required sequence

```text
logical change implemented
  -> verification checkpoint
  -> source commit
  -> prepend one CHANGE_LEDGER entry referencing that commit SHA
  -> commit ledger bookkeeping
  -> only then start the next independent logical change
```

If a session terminates between the source commit and the ledger bookkeeping commit, the next session must reconstruct the missing entry from Git history before proceeding.

## Entry template

```markdown
## CHANGE-YYYYMMDD-NNN — <short title>

- Time: YYYY-MM-DD HH:MM KST
- Type: feat | fix | db | ops | refactor | security | docs | test | chore
- Area: <schedule | form | contact | mail | participant | deploy | auth | docs | ...>
- Source commit: `<sha>`
- Branch: `<main or work/...>`
- Status: committed | DB-applied | edge-deployed | production-deployed | verified | superseded | reverted

### What changed
- <exact behavior/code change>

### Files / objects
- `<path or DB object>`

### Database
- Migration: `<name or none>`
- Production applied: yes/no/not-applicable
- Live verification: `<query/result or none>`

### Edge / provider
- Function/provider: `<slug or none>`
- Deployment/auth state: `<version / verify_jwt / custom auth / none>`

### Application deployment
- Deployment ID: `<dpl_... or not deployed>`
- Production commit: `<sha or unchanged>`

### Verification
- `[PASS/FAIL] <actual check>`

### Notes / follow-up
- <remaining caveat, or none>
```

---

## CHANGE-20260817-007 — Normalize codeload archive root before Vercel snapshot

- Time: 2026-08-17 17:51 KST
- Type: fix
- Area: deploy / vercel-control
- Source commit: `69bc18301e6964c04dfccefc40a0c88a7365a0b7`
- Branch: `main`
- Status: verified

### What changed
- Reworked the codeload tar parser into two passes: first collect regular-file entries, then determine and strip the common archive root directory.
- Added a hard validation that `package.json` exists after root normalization before sending the snapshot to Vercel.
- This fixes the first exact-SHA codeload deployment reaching Vercel with incorrectly rooted paths and failing with `missing_pages_app`.

### Files / objects
- `supabase/functions/vercel-control/index.ts`
- live Edge Function target: `vercel-control`

### Database
- Migration: none
- Production applied: not-applicable
- Live verification: no schema change

### Edge / provider
- Function/provider: `vercel-control`
- Deployment/auth state: live version 4 ACTIVE; `verify_jwt=false` with existing custom high-entropy `controlKey`

### Application deployment
- Deployment ID: `dpl_namA9eDG4cEDWMDEqhwx8exTLxXZ`
- Production commit: `79dfc2cd0777031a2d64f2dda734e30b98d1fe1f`

### Verification
- `[PASS]` source commit `69bc18301e6964c04dfccefc40a0c88a7365a0b7` created after v3 codeload reached Vercel but failed with `missing_pages_app`.
- `[PASS]` Edge Function v4 deployed ACTIVE with corrected parser.
- `[PASS]` exact-SHA codeload deployment completed READY as `dpl_namA9eDG4cEDWMDEqhwx8exTLxXZ`.
- `[PASS]` `deploy_control_state.details.snapshotSource = github-codeload` and `commitSha = 79dfc2cd0777031a2d64f2dda734e30b98d1fe1f`.

### Notes / follow-up
- The package.json guard now fails inside deploy-control before creating a Vercel deployment if archive-root parsing regresses.

---

## CHANGE-20260817-006 — Add exact-SHA codeload fallback to deployment control

- Time: 2026-08-17 17:55 KST
- Type: ops
- Area: deploy / vercel-control
- Source commit: `37d1be727d73824abd7d3b10b47023a78b8da5b6`
- Branch: `main`
- Status: verified

### What changed
- Added the previously live-only `vercel-control` Edge Function source to GitHub under `supabase/functions/vercel-control/index.ts`.
- Added deterministic snapshot support through `codeload.github.com` when the deploy manifest includes an exact `commitSha`.
- Exact-SHA codeload deployments avoid the low unauthenticated GitHub REST API rate limit on shared Supabase egress IPs while preserving deterministic source selection.
- Existing GitHub REST snapshot behavior remains available when no explicit commit SHA is provided.
- Deployment state records `snapshotSource` so future handoffs can distinguish `github-codeload` from `github-api`.

### Files / objects
- `supabase/functions/vercel-control/index.ts`
- live Edge Function target: `vercel-control`

### Database
- Migration: none
- Production applied: not-applicable
- Live verification: no schema change

### Edge / provider
- Function/provider: `vercel-control`
- Deployment/auth state: fallback first deployed in v3; current live v4 ACTIVE includes this fallback plus CHANGE-007 parser correction; `verify_jwt=false` with custom `controlKey`

### Application deployment
- Deployment ID: `dpl_namA9eDG4cEDWMDEqhwx8exTLxXZ`
- Production commit: `79dfc2cd0777031a2d64f2dda734e30b98d1fe1f`

### Verification
- `[PASS]` pg_net request `119` established the original failure mode: unauthenticated GitHub REST `API rate limit exceeded`.
- `[PASS]` exact-SHA codeload path bypassed the rate limit and created Vercel deployments.
- `[FAIL then fixed by CHANGE-007]` v3 codeload parser produced `missing_pages_app` on `dpl_2x8TvtPSYyDCvZXT3mcx3P2PhJrk`.
- `[PASS]` v4 corrected path produced READY deployment `dpl_namA9eDG4cEDWMDEqhwx8exTLxXZ`.

### Notes / follow-up
- A long-lived authenticated `github_token` would also avoid REST rate limits, but exact-SHA codeload now provides a token-free deterministic fallback for this public repo.

---

## CHANGE-20260817-005 — Auto-save dirty form before publishing or reopening recruitment

- Time: 2026-08-17 17:46 KST
- Type: fix
- Area: form / study-lifecycle
- Source commit: `1bde332ad88126b2eceb5361243c392be960466e`
- Branch: `main`
- Status: production-deployed

### What changed
- Exposed the mounted unified Form Builder's existing `save()` operation to the StudyWorkspace through a transient browser callback.
- `모집 시작` and `모집 재개` detect unsaved form changes, save them first, wait for the dirty state to clear, and only then change the study status to `published`.
- If form validation or persistence fails and the dirty state remains, publishing is aborted instead of exposing stale saved data.
- `모집 중지` does not force an unrelated save; autosave applies only when entering the published state.

### Files / objects
- `scripts/prebuild-ui-copy.mjs`
- build-time runtime targets: `src/app/page.tsx`, `src/components/FormBuilderUnified.tsx`

### Database
- Migration: none
- Production applied: not-applicable
- Live verification: no schema change

### Edge / provider
- Function/provider: none
- Deployment/auth state: none

### Application deployment
- Deployment ID: `dpl_namA9eDG4cEDWMDEqhwx8exTLxXZ`
- Production commit: `79dfc2cd0777031a2d64f2dda734e30b98d1fe1f`

### Verification
- `[PASS]` source commit created on `main` with publish-before-save orchestration.
- `[PASS]` Vercel production build completed READY with the prebuild transformation applied.
- `[NOT RUN]` authenticated researcher click-flow E2E was not available in this connector-only session; behavior is deployed but the actual authenticated button sequence was not browser-clicked here.

### Notes / follow-up
- This uses the existing build-time UI transformation layer; removing that layer remains separate technical debt.

---

## CHANGE-20260817-004 — Require recruitment stop before permanent study deletion

- Time: 2026-08-17 17:42 KST
- Type: fix
- Area: study-lifecycle / admin-home
- Source commit: `19a3d9dbd51040d55d9617485f212f4597231447`
- Branch: `main`
- Status: production-deployed

### What changed
- Changed the admin lifecycle so stopping a published study moves it to `closed` instead of back to `draft`.
- On the researcher home, a published study shows `모집 중지` in the destructive-action position; after the study is stopped, that action becomes `삭제`.
- Added a defensive guard so a published study cannot be permanently deleted until recruitment has been stopped.
- Closed studies show `모집 재개` in the workspace rather than being indistinguishable from a never-published draft.

### Files / objects
- `scripts/prebuild-ui-copy.mjs`
- build-time runtime targets: `src/app/page.tsx`, `src/components/ResearchHome.tsx`

### Database
- Migration: none
- Production applied: not-applicable
- Live verification: existing `studies.status` supports `draft | published | closed`

### Edge / provider
- Function/provider: none
- Deployment/auth state: none

### Application deployment
- Deployment ID: `dpl_namA9eDG4cEDWMDEqhwx8exTLxXZ`
- Production commit: `79dfc2cd0777031a2d64f2dda734e30b98d1fe1f`

### Verification
- `[PASS]` source commit created on `main` with the stop-before-delete build transformation.
- `[PASS]` Vercel production build completed READY with the transformation applied.
- `[NOT RUN]` authenticated researcher click-flow E2E was not available in this connector-only session; the stop/delete sequence was not browser-clicked here.

### Notes / follow-up
- This change intentionally uses the repository's existing build-time UI transformation layer; eliminating that layer remains separate technical debt.

---

## CHANGE-20260817-003 — Add disposable-workspace rehydration and recovery protocol

- Time: 2026-08-17 13:46 KST
- Type: docs
- Area: development-process / workspace
- Source commit: `4fcea25458897f5ddd5a86f56c661d45f1b7e91f`
- Branch: `main`
- Status: verified

### What changed
- Added `docs/WORKSPACE_PROTOCOL.md` defining `/mnt/data/research-align` as a preferred logical workspace path rather than durable storage.
- Defined `git-checkout`, `connector-only`, and `partial-scratch` workspace modes.
- Required a new session to recover the expected GitHub branch/HEAD before trusting or modifying a surviving mount.
- Added safe handling for clean/stale, dirty/locally-ahead, wrong-repository, and missing checkout states.
- Prohibited destructive reset/clean/delete of a dirty unknown checkout until potentially valuable local work is preserved or classified.
- Added a connector-only fallback for sandboxes where shell Git network access is unavailable.
- Added rules for dependency/cache non-persistence, secret handling, build-time `prebuild-ui-copy.mjs` mutations, interrupted-session recovery, and end-of-session `safe_to_lose_current_mount` reconciliation.
- Integrated workspace mode/state into `AGENTS.md`, `SESSION_PROTOCOL.md`, and `HANDOFF_TEMPLATE.md`.

### Files / objects
- `AGENTS.md`
- `docs/WORKSPACE_PROTOCOL.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/HANDOFF_TEMPLATE.md`

### Database
- Migration: none
- Production applied: not-applicable
- Live verification: production deploy-control state rechecked separately; no DB change made

### Edge / provider
- Function/provider: none
- Deployment/auth state: none

### Application deployment
- Deployment ID: not deployed
- Production commit: unchanged at the time of this process-only change

### Verification
- `[PASS]` four protocol files were committed atomically as source commit `4fcea25458897f5ddd5a86f56c661d45f1b7e91f` and `main` was fast-forwarded to that commit.
- `[PASS]` current-session shell clone attempt demonstrated the intended fallback condition: direct Git failed with `Could not resolve host: github.com`, while the GitHub connector remained usable.

### Notes / follow-up
- The protocol intentionally does not promise physical `/mnt/data` persistence across conversations; it makes a surviving checkout reusable only after verification and otherwise reconstructs state from durable GitHub/live infrastructure.

---

## CHANGE-20260817-002 — Make per-change ledger mandatory in development protocol

- Time: 2026-08-17 12:34 KST
- Type: docs
- Area: development-process
- Source commit: `d8b63b1ef32de06afacea97208910e889fdf4a3f`
- Branch: `main`
- Status: verified

### What changed
- Made `docs/CHANGE_LEDGER.md` mandatory reading and mandatory per-change bookkeeping.
- Required every meaningful source commit to receive exactly one granular ledger entry before the next independent logical change begins.
- Added recovery rules for commits that exist without a ledger entry after an interrupted session.
- Extended the handoff template so every session maps source commits to Change IDs and records DB/Edge/deployment verification by Change ID.

### Files / objects
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/HANDOFF_TEMPLATE.md`
- `docs/CHANGE_LEDGER.md`

### Database
- Migration: none
- Production applied: not-applicable
- Live verification: none

### Edge / provider
- Function/provider: none
- Deployment/auth state: none

### Application deployment
- Deployment ID: not deployed
- Production commit: unchanged at the time of this process-only change

### Verification
- `[PASS]` policy/source commit created as `d8b63b1ef32de06afacea97208910e889fdf4a3f` and fast-forwarded to `main`.

### Notes / follow-up
- This ledger bookkeeping commit is exempt from its own ledger entry by rule.

---

## CHANGE-20260817-001 — Establish granular per-change recording rule

- Time: 2026-08-17 12:33 KST
- Type: docs
- Area: development-process
- Source commit: `2e475a880495575de41376a3fde786ae7f749abd`
- Branch: `main`
- Status: verified

### What changed
- Added a granular change ledger so future development records every meaningful logical modification individually rather than only summarizing at session end.
- Established the one-logical-change/one-ledger-entry model.

### Files / objects
- `docs/CHANGE_LEDGER.md`

### Database
- Migration: none
- Production applied: not-applicable
- Live verification: none

### Edge / provider
- Function/provider: none
- Deployment/auth state: none

### Application deployment
- Deployment ID: not deployed
- Production commit: unchanged at the time of this process-only change

### Verification
- `[PASS]` GitHub `main` advanced to `2e475a880495575de41376a3fde786ae7f749abd` with this file added.

### Notes / follow-up
- Superseded by the stronger mandatory protocol in `CHANGE-20260817-002`; the original entry remains for history.
