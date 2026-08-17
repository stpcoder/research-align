# Research Align — Latest Session Handoff

Handoff prepared: **2026-08-17 17:58 KST**

Read root `AGENTS.md` first, then this file, `docs/PROJECT_STATE.md`, `docs/WORKSPACE_PROTOCOL.md`, `docs/SESSION_PROTOCOL.md`, and `docs/CHANGE_LEDGER.md`.

## 1. Session identity

- repository: `stpcoder/research-align`
- active branch: `main`
- work status: `clean`
- session topic: stop-before-delete lifecycle, publish autosave, and deployment-control recovery
- next session should continue branch: `main`
- no source/runtime feature is partially implemented
- no local-only product code is being carried forward

### Workspace hydration state

- preferred workspace path: `/mnt/data/research-align`
- workspace mode: `connector-only`
- local canonical checkout available: no trusted full checkout
- local-only state remaining: none
- safe to lose current mount: yes
- local build environment available: no
- production build verification instead came from the successful Vercel deployment

## 2. Exact source state

GitHub `main` immediately before the final HANDOFF + DEVELOPMENT_LOG commit:

`8c3a280465e1131cca6ad8c38bb91bf2c2fdd641`

Message:

`docs(state): record lifecycle and deploy fallback`

The final handoff commit containing this file and the new DEVELOPMENT_LOG entry will be newer than `8c3a280...`; the next session must query live `main` HEAD.

### Last production-deployed source

Production currently runs exact source snapshot:

`79dfc2cd0777031a2d64f2dda734e30b98d1fe1f`

GitHub `main` is ahead only by documentation/bookkeeping commits:

- `f4d026380590660b7c72835269bc2cc30dcab70b` — ledger rollout-state update
- `8c3a280465e1131cca6ad8c38bb91bf2c2fdd641` — durable PROJECT_STATE update
- final handoff/log commit — created after this document is written

There is **no unexplained runtime drift**. All application and deploy-control source changes required for this session are ancestors of production commit `79dfc2cd...`.

### Meaningful source commits created this session

1. `19a3d9dbd51040d55d9617485f212f4597231447` — `fix(study): require stop before delete`
2. `1bde332ad88126b2eceb5361243c392be960466e` — `fix(form): save changes before publishing`
3. `37d1be727d73824abd7d3b10b47023a78b8da5b6` — `ops(deploy): add codeload snapshot fallback`
4. `69bc18301e6964c04dfccefc40a0c88a7365a0b7` — `fix(deploy): normalize codeload archive root`

### Granular change ledger mapping

| Change ID | Source commit | Latest state |
|---|---|---|
| `CHANGE-20260817-004` | `19a3d9dbd51040d55d9617485f212f4597231447` | production-deployed |
| `CHANGE-20260817-005` | `1bde332ad88126b2eceb5361243c392be960466e` | production-deployed |
| `CHANGE-20260817-006` | `37d1be727d73824abd7d3b10b47023a78b8da5b6` | verified |
| `CHANGE-20260817-007` | `69bc18301e6964c04dfccefc40a0c88a7365a0b7` | verified |

Every meaningful source commit from this session has a corresponding ledger entry.

## 3. User-facing behavior now deployed

### Study stop/delete lifecycle

```text
published -> 모집 중지 -> closed -> 삭제
```

- a published study shows `모집 중지` rather than direct delete
- stopping writes `studies.status = closed`
- after stop, `삭제` is available
- delete still requires typing the exact study title
- a defensive delete guard refuses a still-published study
- closed studies can be reopened via `모집 재개`

### Publish autosave

When clicking `모집 시작` or `모집 재개`:

- if the unified Form Builder is dirty, its existing `save()` is invoked first
- publishing waits for dirty state to clear
- if save/validation fails and dirty remains, publishing is aborted
- status changes to `published` only after the save checkpoint

This addresses the reported case where a researcher edits a new project, clicks publish without manual save, returns home, and finds that the latest edits were not actually published.

## 4. Production application state

Live `public.deploy_control_state` after the successful retry:

- Vercel project ID: `prj_m1b582jShPhKBRfxY8GLDxAPFrGQ`
- production deployment ID: `dpl_namA9eDG4cEDWMDEqhwx8exTLxXZ`
- status: `READY`
- production URL: `https://research-align.vercel.app`
- production commit: `79dfc2cd0777031a2d64f2dda734e30b98d1fe1f`
- snapshot source: `github-codeload`
- state updated: `2026-08-17 17:53:05 KST`
- errorCode/errorMessage: null

The Vercel build succeeded with the build-time transformation containing the two product fixes.

## 5. Supabase / deploy job state

- project: `rgwqsqeikebwunbdnbex`
- no DB schema migration was required
- existing study status constraint already supports `draft | published | closed`

Deploy attempts:

1. `e0bf2301-cb19-455e-bfd4-c9055df98ec1` / request `119`
   - final: `failed`
   - GitHub unauthenticated REST rate limit before source snapshot
2. `f4dbac77-d196-47ea-8e86-9edc81a2a84e` / request `120`
   - final: `failed`
   - deployment `dpl_2x8TvtPSYyDCvZXT3mcx3P2PhJrk`
   - Vercel `missing_pages_app` caused by first codeload archive-root parser
3. `5f82cd22-5b48-4843-be49-7ec9e075a546` / request `121`
   - final: `succeeded`
   - deployment `dpl_namA9eDG4cEDWMDEqhwx8exTLxXZ`
   - Vercel `READY`

The first stale job row was reconciled from misleading `running` to `failed` after its HTTP 500 result was confirmed.

## 6. Edge Functions

### `vercel-control`

- source: `supabase/functions/vercel-control/index.ts`
- live version: **4**
- status: `ACTIVE`
- `verify_jwt`: `false`
- authentication: separate private high-entropy `controlKey`

Current source snapshot behavior:

- exact `commitSha` -> `github-codeload` snapshot
- no exact SHA -> GitHub REST compatibility path
- common tar root normalized before file upload
- `package.json` required before Vercel deployment creation
- `snapshotSource` recorded in deploy state

No temporary Edge Function/probe was created.

## 7. Verification performed

### Source / ledger

- `[PASS]` CHANGE-004 source committed and ledgered
- `[PASS]` CHANGE-005 source committed and ledgered
- `[PASS]` CHANGE-006 source committed and ledgered
- `[PASS]` CHANGE-007 source committed and ledgered
- `[PASS]` rollout state reconciled in ledger

### Deployment / build

- `[FAIL / diagnosed]` request 119: GitHub REST rate limit
- `[FAIL / diagnosed]` request 120: archive-root parser -> `missing_pages_app`
- `[PASS]` `vercel-control` v4 ACTIVE
- `[PASS]` request 121 returned successful READY deployment
- `[PASS]` production deployment `dpl_namA9eDG4cEDWMDEqhwx8exTLxXZ`
- `[PASS]` deployed exact SHA `79dfc2cd0777031a2d64f2dda734e30b98d1fe1f`
- `[PASS]` `snapshotSource = github-codeload`

### Authenticated researcher browser E2E

- `[NOT RUN]` this session had no authenticated browser researcher context
- the actual click sequences below were therefore not browser-automated:
  - edit new study -> `모집 시작` without manual save -> confirm latest public form
  - published study -> `모집 중지` -> verify `삭제` appears -> delete disposable test study

Do not interpret READY as a claim that those authenticated click sequences were personally clicked in this session. READY verifies source transformation/build/deployment.

## 8. Architecture changes

`docs/PROJECT_STATE.md` was updated because durable product/deployment state changed:

- stop-before-delete lifecycle documented
- publish autosave documented
- `vercel-control` is now source-controlled
- exact-SHA codeload provides deterministic snapshot/deploy without shared-IP GitHub REST rate-limit dependence
- parser uses common-root normalization plus package.json guard

## 9. Known unresolved risks

### P0 before participant-scale pilot

- ClawMail capacity/quota remains unresolved

### P1

- perform one authenticated production smoke test of the two new lifecycle flows when researcher browser context is available
- build-time `scripts/prebuild-ui-copy.mjs` remains brittle technical debt
- `main` still has no required CI/build checks or branch protection
- production demo/test data remains
- legacy KeyID/probe/stale docs cleanup remains

### P2

- Supabase security/index advisor hardening remains

## 10. Exact next action

If an authenticated researcher browser context is available:

> Create/use a disposable study; edit title/form without manual save, click `모집 시작`, confirm DB/public form reflects the latest edits, then click `모집 중지`, confirm the home action becomes `삭제`, and delete the disposable study. Record results in CHANGE_LEDGER/HANDOFF. Do not create a new source Change ID unless a bug is found.

If authenticated browser context is unavailable, the user's next requested development task can proceed; the requested changes are already production-deployed, with the missing browser-click verification remaining explicit.

## 11. Session documentation status

- `docs/CHANGE_LEDGER.md`: reconciled through CHANGE-007
- `docs/PROJECT_STATE.md`: updated
- `docs/DEVELOPMENT_LOG.md`: appended in final handoff commit
- `docs/HANDOFF.md`: this file
- final handoff commit: query current `main` after this file is committed

## 12. Suggested next-chat prompt

> Continue `stpcoder/research-align`. Read `AGENTS.md` and follow the full startup protocol, including HANDOFF, PROJECT_STATE, WORKSPACE_PROTOCOL, SESSION_PROTOCOL, and CHANGE_LEDGER. Verify GitHub main and live Supabase deploy_control_state first. Production contains the stop-before-delete and publish-autosave fixes. If an authenticated researcher browser context is available, run the smoke test in HANDOFF before another lifecycle refactor. Commit and ledger every meaningful new modification separately.
