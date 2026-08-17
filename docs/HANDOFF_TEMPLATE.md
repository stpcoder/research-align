# Research Align — Handoff Template

Copy this structure into `docs/HANDOFF.md` at the end of every development session. Remove sections that are truly not applicable only when doing so cannot create ambiguity.

---

# Research Align — Latest Session Handoff

Handoff prepared: **YYYY-MM-DD HH:MM KST**

## 1. Session identity

- repository: `stpcoder/research-align`
- active branch: `<main or work/...>`
- work status: `<clean | in_progress | blocked>`
- session topic: `<short description>`
- next session should continue branch: `<branch>`

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

### Build/static checks

- `[PASS/FAIL] CHANGE-... — <command/check>` — `<important output>`

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

1. inspect commits newer than `current GitHub main HEAD` recorded above
2. compare meaningful source commits against `docs/CHANGE_LEDGER.md`
3. reconstruct any missing ledger entry before new independent development
4. inspect the recorded active work branch
5. query Supabase migration history
6. query relevant Edge Function versions
7. query `deploy_control_state`
8. reconstruct source/ledger/DB/edge/deployment/verification state before writing new code

## 14. Session log/documentation status

- `docs/CHANGE_LEDGER.md` reconciled with all meaningful source commits? yes/no
- Change IDs created/updated this session: `<list>`
- `docs/PROJECT_STATE.md` updated? yes/no/not needed
- `docs/DEVELOPMENT_LOG.md` appended? yes/no
- final handoff commit: `<sha; fill after commit if possible, otherwise state that current file creation commit must be queried>`

## 15. Suggested next-chat prompt

> Continue `stpcoder/research-align`. Read root `AGENTS.md` and follow its full startup protocol. Read `docs/HANDOFF.md`, `docs/PROJECT_STATE.md`, `docs/SESSION_PROTOCOL.md`, and `docs/CHANGE_LEDGER.md`; read `docs/ADMIN_DESIGN_SYSTEM.md` for UI work. Verify current GitHub branch/HEAD and live Supabase `deploy_control_state` before changing anything. Continue from the exact next action in HANDOFF. For every meaningful logical modification, create one atomic source commit and one corresponding CHANGE_LEDGER entry before starting the next independent change. Finish by reconciling CHANGE_LEDGER, updating HANDOFF, and appending DEVELOPMENT_LOG.
