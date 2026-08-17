# Research Align — Handoff Template

Copy this structure into `docs/HANDOFF.md` at the end of every development session. Remove sections that are truly not applicable only when doing so cannot create ambiguity.

---

# Research Align — Latest Session Handoff

Handoff prepared: **YYYY-MM-DD HH:MM KST**

Read root `AGENTS.md` first, then this file, `docs/PROJECT_STATE.md`, `docs/WORKSPACE_PROTOCOL.md`, `docs/SESSION_PROTOCOL.md`, and `docs/CHANGE_LEDGER.md`.

## 1. Session identity

- repository: `stpcoder/research-align`
- active branch: `<main or work/...>`
- work status: `<clean | in_progress | blocked>`
- session topic: `<short description>`
- next session should continue branch: `<branch>`

### Workspace hydration state

- preferred workspace path: `/mnt/data/research-align`
- workspace mode: `<git-checkout | connector-only | partial-scratch>`
- local path present: `<yes/no/not-applicable>`
- local origin verified as `stpcoder/research-align`: `<yes/no/not-applicable>`
- local branch: `<branch or not-applicable>`
- local HEAD: `<sha or not-applicable>`
- relevant remote branch HEAD: `<sha>`
- local HEAD matches intended remote HEAD: `<yes/no/not-applicable>`
- working tree clean: `<yes/no/not-applicable>`
- local-only state remaining: `<none or exact description>`
- safe to lose current mount: `<yes/no>`
- dependencies/build environment available this session: `<yes/no/partial + notes>`

`safe to lose current mount = no` is exceptional and must include exact recovery instructions.

## 2. Exact source state

- current GitHub `main` HEAD: `<sha>`
- current active branch HEAD: `<sha>`
- last verified logical commit: `<sha>`
- last runtime-affecting commit: `<sha>`
- documentation-only commits after runtime commit: `<sha list or none>`

### Meaningful source commits created this session

List in chronological order. Do not include ledger-only or final handoff bookkeeping commits here.

1. `<sha>` — `<message>` — `<why this is one logical change>`
2. ...

If no meaningful source commits were created, state that explicitly.

### Granular change ledger entries this session

Every meaningful source commit above must map to exactly one entry in `docs/CHANGE_LEDGER.md`.

| Change ID | Source commit | Short description | Latest state |
|---|---|---|---|
| `CHANGE-YYYYMMDD-NNN` | `<sha>` | `<change>` | `<committed/verified/production-deployed/...>` |

If a meaningful source commit has no ledger entry, handoff is incomplete.

## 3. In-progress work

### Current logical unit

`<none>` or a single precise sentence.

### What is already complete in this unit

- ...

### What is not complete

- ...

### Uncommitted/unsafe state

- `<none>` or exact description

Never say only “partially done”. Describe the boundary.

If any uncommitted/local-only source exists only under `/mnt/data`, explain how it was preserved and whether the next session can recover it if the mount disappears.

## 4. Production application state

From live `public.deploy_control_state`:

- Vercel project ID: `prj_m1b582jShPhKBRfxY8GLDxAPFrGQ`
- production deployment ID: `<dpl_...>`
- status: `<READY | ERROR | ...>`
- production URL: `https://research-align.vercel.app`
- production commit: `<sha>`
- state updated at: `<timestamp KST>`

### Source/deployment drift

- `<none>` OR explain exactly why `main_head`, `last_runtime_commit`, and `production_commit` differ.

## 5. Supabase state

- project: `rgwqsqeikebwunbdnbex`
- health: `<status checked this session or not checked>`

### Migrations involved this session

For each migration:

| Migration | Source commit | Change ID | Applied production? | Live verification |
|---|---|---|---:|---|
| `<name>` | `<sha>` | `CHANGE-...` | yes/no | `<query/definition/result>` |

If none, say `None`.

### Functions / triggers / RLS changed

- `<object>` — `<exact change>` — `<verified how>` — `<CHANGE-ID>`

## 6. Edge Functions

For each touched function:

| Function | Change ID | Change | verify_jwt/auth | Live version/status | Invocation verification |
|---|---|---|---|---|---|
| `<slug>` | `CHANGE-...` | ... | ... | ... | ... |

If none, say `None`.

### Temporary probes

- `<none>` OR list each probe and whether it is deleted/disabled.

A probe left enabled must be treated as unresolved work.

## 7. Application files/areas changed

Group by Change ID / logical source commit, not as an undifferentiated file dump.

### `CHANGE-...` — `<source commit message>`

- `path/file`
- `path/file`
- behavior changed: `<one sentence>`

## 8. Verification actually performed

Only list checks actually executed. Map each check to the relevant Change ID when possible.

### Workspace/source verification

- `[PASS/FAIL]` workspace mode declaration and expected branch/HEAD recovery
- `[PASS/FAIL/NOT AVAILABLE]` local origin/branch/HEAD/dirty-state verification
- `[PASS/FAIL/NOT AVAILABLE]` local dependency/build environment availability
- explain `connector-only` limitations instead of claiming unrun checks

### Build/static checks

- `[PASS/FAIL/NOT RUN] CHANGE-... — <command/check>` — `<important output or reason unavailable>`

### Database verification

- `[PASS/FAIL] CHANGE-... — <query/constraint/RPC test>` — `<result>`

### Edge/provider verification

- `[PASS/FAIL] CHANGE-... — ...`

### Production E2E

- `[PASS/FAIL] CHANGE-... — <exact route/flow>` — `<result>`

Do not write “tested” without stating what was tested.

## 9. Bugs/findings discovered this session

- `<finding>`
  - impact:
  - root cause if known:
  - fixed? yes/no
  - commit/reference:
  - change ID if fixed:

## 10. Current product state affected by this session

State only durable changes that the next agent must understand, for example:

- `Schedule cancellation now preserves X...`
- `No durable architecture change this session.`

If durable architecture changed, ensure `docs/PROJECT_STATE.md` was updated.

## 11. Known unresolved risks/blockers

Priority ordered:

### P0

- ...

### P1

- ...

### P2

- ...

Do not copy stale backlog mechanically; remove items that are now fixed and add newly discovered ones.

## 12. Exact next action

Write one primary action that the next session can perform immediately:

> `<single next action>`

Then optional ordered follow-ups:

1. ...
2. ...

## 13. Recovery instructions if this handoff is stale

1. inspect current GitHub `main` and commits newer than the SHA recorded above
2. compare meaningful source commits against `docs/CHANGE_LEDGER.md`
3. reconstruct any missing ledger entry before new independent development
4. inspect the recorded active work branch
5. query Supabase migration history
6. query relevant Edge Function versions
7. query `deploy_control_state`
8. only then inspect any surviving `/mnt/data/research-align` according to `docs/WORKSPACE_PROTOCOL.md`
9. preserve/classify local-only commits/uncommitted changes before destructive commands
10. reconstruct source/ledger/DB/edge/deployment/verification/workspace state before writing new code

## 14. Session log/documentation status

- `docs/CHANGE_LEDGER.md` reconciled with all meaningful source commits? yes/no
- Change IDs created/updated this session: `<list>`
- `docs/PROJECT_STATE.md` updated? yes/no/not needed
- `docs/DEVELOPMENT_LOG.md` appended? yes/no
- workspace reconciled per `docs/WORKSPACE_PROTOCOL.md`? yes/no/not-applicable
- safe to lose current mount? yes/no
- final handoff commit: `<sha; fill after commit if possible, otherwise state that current file creation commit must be queried>`

## 15. Suggested next-chat prompt

> Continue `stpcoder/research-align`. Read root `AGENTS.md` and follow its full startup protocol. Read `docs/HANDOFF.md`, `docs/PROJECT_STATE.md`, `docs/WORKSPACE_PROTOCOL.md`, `docs/SESSION_PROTOCOL.md`, and `docs/CHANGE_LEDGER.md`; read `docs/ADMIN_DESIGN_SYSTEM.md` for UI work. Verify current GitHub branch/HEAD first. Then verify or rehydrate `/mnt/data/research-align` according to WORKSPACE_PROTOCOL; if a trustworthy full checkout is unavailable, explicitly use connector-only mode. Verify live Supabase `deploy_control_state` before changing anything. Continue from the exact next action in HANDOFF. For every meaningful logical modification, create one atomic source commit and one corresponding CHANGE_LEDGER entry before starting the next independent change. Finish by reconciling workspace state, CHANGE_LEDGER, HANDOFF, and DEVELOPMENT_LOG.
