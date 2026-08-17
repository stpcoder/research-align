# Research Align — Workspace Rehydration Protocol

This repository may be developed across many ChatGPT/Codex conversations whose local filesystems are not guaranteed to persist.

The durable state is GitHub + live Supabase/Vercel state. A local `/mnt/data` checkout is a disposable working cache that may be reused when valid, but must never be treated as authoritative merely because the path exists.

## 1. Canonical logical workspace path

Preferred local workspace path:

`/mnt/data/research-align`

This is a **logical convention**, not a persistence guarantee.

A later conversation may receive:

- the same path with the same checkout
- the same path with stale/different contents
- no path at all
- a sandbox where direct Git network access is unavailable

Therefore every session must verify or reconstruct workspace state before editing.

## 2. Workspace modes

Every development session should identify one of these modes.

### `git-checkout`

A full local Git checkout exists at `/mnt/data/research-align` and its origin, branch, HEAD, and dirty state have been verified.

This is the preferred mode for code changes requiring build, lint, dependency installation, or local tests.

### `connector-only`

A trustworthy full local checkout cannot be created or verified, but the GitHub connector can read/write the repository.

In this mode:

- GitHub remains the source of truth
- use connector/tree/commit APIs for atomic source commits
- local `/mnt/data` files, if any, are scratch only
- do not claim `npm build`, lint, or local E2E was run unless an actual checkout/environment was available
- record unavailable checks explicitly in `HANDOFF`

### `partial-scratch`

Only selected files or generated artifacts are present locally. This is useful for analysis but **must not be described as a full repository checkout**.

## 3. Determine the expected source state before touching the mount

Read, in order:

1. root `AGENTS.md`
2. `docs/HANDOFF.md`
3. `docs/PROJECT_STATE.md`
4. this file
5. `docs/SESSION_PROTOCOL.md`
6. `docs/CHANGE_LEDGER.md`

Then query GitHub to establish:

- current `main` HEAD
- active work branch recorded in HANDOFF, if any
- current HEAD of that work branch
- commits newer than HANDOFF

The expected branch is:

- the recorded `work/...` branch when HANDOFF says work is in progress there
- otherwise `main`

Do not create a replacement work branch before checking whether the recorded branch still exists.

## 4. Inspect an existing `/mnt/data/research-align` before reuse

If the path exists, do **not** immediately `git pull`, `git reset --hard`, `git clean`, or delete it.

First determine:

```bash
cd /mnt/data/research-align
pwd
git rev-parse --is-inside-work-tree
git remote get-url origin
git branch --show-current
git rev-parse HEAD
git status --porcelain=v1
```

A checkout is reusable only when all applicable checks pass:

- it is a Git work tree
- `origin` resolves to `stpcoder/research-align`
- branch is the expected branch
- local HEAD is understood relative to the live GitHub branch HEAD
- local dirty state is empty, or every local change is deliberately recognized as the current in-progress logical unit

### Clean and exact

If origin, branch, HEAD, and clean state match expectations, reuse the checkout.

### Clean but stale

Fetch/update to the intended remote branch using a fast-forward-safe path. Re-verify HEAD afterward.

Do not merge arbitrary local history into `main` merely to make the checkout current.

### Dirty or locally ahead

Treat it as possible recovery material, not disposable junk.

Before destructive action, capture:

```bash
git status --porcelain=v1
git diff
git diff --cached
git log --oneline --decorate -n 20
```

Also identify untracked files.

If possible, preserve unknown local work by one of these methods before replacement:

- commit it on the already-recorded work branch when it is a legitimate coherent checkpoint
- create a recovery branch
- save a patch plus untracked files in a timestamped recovery location outside the checkout
- rename/quarantine the whole checkout if filesystem operations permit

Never run `git reset --hard`, `git clean -fd`, or `rm -rf /mnt/data/research-align` on a dirty/unknown checkout until its potentially valuable state has been made durable or explicitly classified as disposable.

### Wrong repository

If the path is not `stpcoder/research-align`, do not mutate that repository. Use a different temporary path or quarantine it before constructing the canonical workspace.

## 5. Rehydrate when no valid checkout exists

### Preferred path: normal Git checkout

When shell Git network access is available:

```bash
git clone https://github.com/stpcoder/research-align.git /mnt/data/research-align
cd /mnt/data/research-align
git fetch origin --prune
```

Then check out the expected branch and verify its exact HEAD against GitHub.

For `main`, the local HEAD should equal the current live `main` SHA before editing.

For a recorded `work/...` branch, fetch and continue that exact branch rather than recreating the work from memory.

### When shell network access is unavailable

Some ChatGPT sandboxes may not be able to resolve or reach GitHub directly even though the GitHub connector works.

In that case:

1. do not repeatedly retry destructive or speculative clone work
2. switch the session to `connector-only`
3. use GitHub connector reads to recover source state
4. use GitHub blob/tree/commit APIs for atomic changes when appropriate
5. use `/mnt/data` only for temporary analysis/generated artifacts
6. explicitly record that a full local build/test environment was unavailable

The absence of a local clone must never cause creation of a new repository, new Vercel project, or untracked duplicate source tree.

## 6. Mandatory verification before the first edit

In `git-checkout` mode, confirm:

```text
workspace_path = /mnt/data/research-align
origin = stpcoder/research-align
branch = expected branch from HANDOFF/live GitHub
local_head = live branch head
working_tree = clean
```

If the working tree is intentionally dirty because an interrupted logical unit is being recovered, identify that unit in the session update before adding unrelated changes.

In `connector-only` mode, confirm instead:

```text
workspace_mode = connector-only
repository = stpcoder/research-align
branch = expected branch
branch_head = live GitHub SHA
local checkout verification = not available
```

## 7. Dependencies and generated state are not durable

Do not assume these survive between sessions:

- `node_modules`
- `.next`
- caches
- shell history
- locally generated test data
- temporary patches
- browser sessions
- process state
- local environment variables

When local verification requires dependencies, install from the committed lockfile using the project-standard command when network/runtime access permits.

Do not commit dependency directories or build caches.

## 8. Secrets must never be recovered from an old mount

Do not treat an old `.env`, shell history, credentials file, token cache, or copied provider secret under `/mnt/data` as trusted durable configuration.

Use the current approved connector/private environment and live Supabase secret storage instead.

Never commit secrets while rebuilding a workspace.

## 9. Project-specific build mutation warning

Research Align currently runs `scripts/prebuild-ui-copy.mjs` before both `next dev` and `next build`. That script mutates parts of `src/app/page.tsx`.

Therefore, in `git-checkout` mode:

1. record `git status` before build/dev
2. run the intended check
3. inspect `git status` and diff afterward
4. distinguish expected prebuild rewriting from intentional source edits
5. do not accidentally commit generated/rewrite output as an unrelated change

This warning remains until the build-time rewrite layer is removed.

## 10. During development: local state is provisional until GitHub commit

A completed logical change is not durable merely because it exists under `/mnt/data/research-align`.

Required sequence remains:

```text
implement
-> verify practical checkpoint
-> atomic source commit in GitHub
-> CHANGE_LEDGER entry referencing exact source SHA
-> ledger bookkeeping commit
-> next independent change
```

For long/risky work, use the recorded `work/YYYYMMDD-<topic>` branch so completed checkpoints survive even if the conversation ends.

Do not leave hours of completed work only in the mount.

## 11. End-of-session workspace reconciliation

Before handoff, record:

- workspace mode
- preferred path
- active branch
- local HEAD if a checkout exists
- whether local HEAD matches the relevant remote HEAD
- whether working tree is clean
- any local-only commit/change/file not yet durable in GitHub
- whether the local checkout can be safely discarded

A normal clean handoff should end with:

```text
workspace_mode: git-checkout or connector-only
local_only_state: none
completed logical changes durable in GitHub: yes
safe_to_lose_current_mount: yes
```

If `safe_to_lose_current_mount = no`, HANDOFF must describe exactly what would be lost and how the next session should recover it. This is an exceptional state, not the normal operating model.

## 12. Recovery order after an unexpected session termination

The next session should recover in this order:

1. GitHub `main` / recorded work branch
2. `HANDOFF`
3. `CHANGE_LEDGER`
4. live Supabase/Edge/deployment state
5. only then inspect any surviving `/mnt/data/research-align`

The mount is evidence that may contain additional unfinished work; it is not authoritative over already-committed GitHub state.

If the mount contains a local commit absent from GitHub, preserve and inspect it before resetting anything.

If the mount contains only uncommitted changes, compare them with HANDOFF/current GitHub and classify them before reuse.

## 13. No-persistence assumption

At the end of every session, behave as if `/mnt/data/research-align` will disappear immediately.

If the next session can reuse it, that is an optimization.

If it disappears, the new session must still be able to continue using GitHub + HANDOFF + CHANGE_LEDGER + live infrastructure state alone.

That is the acceptance criterion for this protocol.

## 14. Suggested startup report

Before making the first meaningful edit, a new session should be able to state something equivalent to:

```text
Repository: stpcoder/research-align
Expected branch: main
GitHub HEAD: <sha>
Workspace mode: git-checkout | connector-only
Workspace path: /mnt/data/research-align | unavailable
Local origin/head/status: verified | not available
Production commit: <sha>
Unfinished logical unit: none | <exact unit>
Safe to begin new change: yes/no
```

Do not begin unrelated development while `Safe to begin new change` is `no`.
