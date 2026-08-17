# Research Align — Cross-Session Development Protocol

This is the concrete operating procedure for development that may span many ChatGPT/Codex conversations.

The objective is simple: at any moment, a new session should be able to determine exactly what is committed, what is live, what is verified, what changed one item at a time, what local workspace state exists, and what remains.

## 1. State model

Always distinguish these states. Never collapse them into “done”.

```text
A. Source state
   GitHub branch + commit

B. Database state
   migration applied? live function/constraint/RLS verified?

C. Edge Function state
   function/version deployed? JWT/410 probe cleanup state?

D. Application deployment state
   Vercel deployment ID + READY/ERROR + deployed commit

E. Behavior verification state
   which production path was actually tested?

F. Change record state
   does every meaningful source commit have exactly one CHANGE_LEDGER entry?

G. Workspace state
   git-checkout / connector-only / partial-scratch?
   path, origin, branch, HEAD, dirty/local-only state verified?
```

A feature is complete only when every state relevant to it is explicitly known.

## 2. Session start — mandatory preflight

### Step 1: read repository memory

Read:

1. `AGENTS.md`
2. `docs/HANDOFF.md`
3. `docs/PROJECT_STATE.md`
4. `docs/WORKSPACE_PROTOCOL.md`
5. this file
6. `docs/CHANGE_LEDGER.md`
7. additional domain docs relevant to the request

### Step 2: establish expected source state

Before touching an existing `/mnt/data/research-align`, verify through GitHub/HANDOFF:

- current `main` HEAD
- active work branch from HANDOFF, if any
- current HEAD of that work branch
- commits newer than HANDOFF's recorded checkpoint
- meaningful commits missing from `CHANGE_LEDGER`, if any

The repository/remote state determines what the workspace should contain; the mount does not determine repository truth.

### Step 3: verify or rehydrate workspace

Follow `docs/WORKSPACE_PROTOCOL.md`.

Declare one mode:

- `git-checkout` — full verified checkout at `/mnt/data/research-align`
- `connector-only` — GitHub connector is authoritative because no trustworthy full checkout can be created/verified
- `partial-scratch` — only selected local files/artifacts exist; not a full checkout

If `/mnt/data/research-align` already exists, verify origin, branch, HEAD, and dirty state before reuse.

Never discard a dirty/unknown checkout with `git reset --hard`, `git clean -fd`, or deletion until potentially valuable local work has been preserved or explicitly classified as disposable.

If shell Git network access is unavailable but the GitHub connector works, use `connector-only` mode rather than pretending a clone exists.

### Step 4: establish live infrastructure baseline

Verify at least:

- Supabase project health when DB work is involved
- latest applied migrations when DB work is involved
- relevant Edge Function state when involved
- `deploy_control_state` for `research-align`
- production deployed commit + deployment ID/status

Write down discrepancies before editing.

### Step 5: classify the requested work

Choose one:

- small verified fix/change → direct `main` may be acceptable
- multi-step/risky/refactor/migration-heavy work → use `work/YYYYMMDD-<topic>`
- investigation only → do not mutate production/source unnecessarily

State which invariants may be affected: scheduling, contact state, email, RLS/security, deployment, public participant flow, or workspace/build behavior.

Do not start a new unrelated logical unit while source/ledger/workspace recovery is unresolved.

## 3. Work item loop

Repeat this loop for every logical change.

### 3.1 Define one logical unit

Examples:

- “Prevent session B from starting inside session A's buffer.”
- “Show cancelled assignment in participant details.”
- “Retry failed schedule cancellation notification.”

If the sentence contains unrelated “and also”, split it unless both parts are required for the same behavior.

### 3.2 Inspect before edit

Read the minimum relevant surfaces plus their invariant enforcement layer.

For example, a scheduling UI change often requires checking PostgreSQL trigger/RPC behavior before editing.

In `git-checkout` mode, confirm the working tree is clean before beginning a new independent logical unit unless deliberately recovering an interrupted one.

### 3.3 Implement atomically

A logical change can span multiple files. Keep them in one source commit when they must move together.

Typical feature commit may include:

```text
src/components/...
src/lib/types.ts
supabase/migrations/...
supabase/functions/...
tests or verification helpers
```

Do not create arbitrary one-file commits if that makes an intermediate commit internally inconsistent.

In `connector-only` mode, prefer GitHub tree/commit APIs when multiple files must form one atomic commit.

### 3.4 Verify before source commit

Run the strongest practical checks for the surface changed and the declared workspace mode:

- TypeScript/Next build or type checking
- lint where meaningful
- targeted DB query/function invocation
- constraint/trigger definition inspection
- Edge Function invocation
- UI/E2E path

Record what was actually checked, not what was intended.

If a full checkout/dependency environment was unavailable, say so. Do not convert “could not run” into “passed”.

Because `scripts/prebuild-ui-copy.mjs` mutates source before dev/build, a local checkout must compare `git status`/diff before and after build and classify resulting changes before committing.

### 3.5 Commit immediately after a verified logical checkpoint

Use a descriptive conventional source commit.

```text
feat(schedule): add researcher-wide conflict visibility
fix(contact): preserve pending state after schedule email
db(schedule): include buffer in public busy intervals
ops(mail): disable cancellation probe
```

A completed checkpoint is durable only after it exists in GitHub, not merely under `/mnt/data`.

### 3.6 Immediately create the granular change record

Before beginning the next independent logical change:

1. prepend one entry to `docs/CHANGE_LEDGER.md`
2. give it an ID such as `CHANGE-20260817-003`
3. reference the exact source commit SHA from step 3.5
4. record exact behavior, affected files/objects, and current state across DB/Edge/deployment/verification
5. commit the ledger update, normally as `docs(ledger): record <short-change>`

A meaningful source commit must not remain unrecorded while a new independent change begins.

Pure `docs(ledger): ...` and final `docs(handoff): ...` bookkeeping commits are exempt from getting their own ledger entries. This prevents recursive logging.

If the same source change is later migrated/deployed/E2E-verified, amend that existing change entry with the new state in a bookkeeping commit. Do not create a second logical change entry merely because rollout progressed.

### 3.7 Start the next independent change only after the previous one is committed and recorded

This is the core cross-session rule. A terminated conversation should lose at most the currently incomplete logical unit, not an entire session of completed work.

## 4. Branch strategy

### Small changes

Small, self-contained, verified changes may be committed directly to `main` under the current repository policy.

### Large/risky work

Create:

`work/YYYYMMDD-<topic>`

Use when:

- refactor touches many existing behaviors
- schema changes are risky/breaking
- work will likely take multiple sessions
- production should not snapshot intermediate source
- multiple verified checkpoints need to persist before final integration

On a work branch:

1. commit each verified logical checkpoint
2. record each source commit in `CHANGE_LEDGER`
3. keep HANDOFF updated with branch + HEAD if the session ends
4. next session continues that exact branch
5. workspace hydration must target that recorded branch rather than silently starting from `main`
6. complete build/tests
7. integrate into `main`
8. deploy only the intended `main` commit

Never abandon a recorded work branch and recreate the same work from memory without inspecting it first.

## 5. Database rollout protocol

### Normal backward-compatible change

Preferred order:

1. implement source + migration
2. commit the logical source change
3. create its `CHANGE_LEDGER` entry
4. apply migration to Supabase
5. verify live DB definition
6. update the same ledger entry with DB-applied/verified state
7. deploy the exact application commit
8. production E2E
9. update the same ledger entry with deployment/E2E state

### Breaking change

Use expand/deploy/contract:

#### Commit A — expand

Add backward-compatible column/function/constraint behavior.

Apply and verify DB. Record one ledger entry for Commit A.

#### Commit B — application

Switch application to new shape.

Deploy and verify. Record one ledger entry for Commit B.

#### Commit C — contract

Only after production verification, remove old shape/compatibility. Record one ledger entry for Commit C.

This prevents a deployment or DB failure from leaving application and database mutually incompatible.

### Migration bookkeeping

HANDOFF and the corresponding CHANGE_LEDGER entry must list:

- migration file/name
- committed SHA containing it
- whether it is applied in production
- live verification performed

Never rely only on “the SQL was run”.

## 6. Edge Function rollout protocol

For every changed function record in the corresponding CHANGE_LEDGER entry and HANDOFF:

- slug
- intended auth model (`verify_jwt` true/false + custom authentication if false)
- deployed version if available
- invocation test result

Temporary functions/probes must have an explicit cleanup line.

A probe is not finished until it is either deleted or returned to the accepted disabled state (`verify_jwt=true`, HTTP 410) where applicable.

## 7. Production application deployment protocol

Research Align's primary path is the Supabase Vercel control plane; do not replace it with a new Vercel project.

Before deployment:

- identify exact intended `main` commit
- confirm no unrelated unverified commits are being accidentally included
- confirm required DB changes are in the correct rollout state

After deployment query `deploy_control_state` and record in HANDOFF and relevant ledger entries:

- project ID
- deployment ID
- status
- production URL
- `details.commitSha`
- timestamp

The deployment is not considered verified merely because Vercel says READY. Test the relevant production behavior.

## 8. Runtime commit vs documentation HEAD

The ledger and final handoff documentation commits often make GitHub `main` newer than the deployed application SHA.

That is allowed when the difference is documentation/tooling only.

HANDOFF must explicitly distinguish:

```text
main_head: <latest repo commit>
last_runtime_commit: <latest commit that changes deployed runtime behavior>
production_commit: <commit recorded by deploy_control_state>
```

If `last_runtime_commit != production_commit`, explain why. Never leave unexplained runtime drift.

## 9. Workspace state vs durable state

A local workspace can be useful but is never the durability boundary.

HANDOFF must distinguish:

```text
workspace_mode: git-checkout | connector-only | partial-scratch
workspace_path: /mnt/data/research-align | unavailable
local_head: <sha or not-applicable>
remote_head: <sha>
working_tree_clean: yes/no/not-applicable
local_only_state: none | <exact state>
safe_to_lose_current_mount: yes/no
```

Normal target: `local_only_state = none` and `safe_to_lose_current_mount = yes`.

If the mount disappears between sessions, GitHub + HANDOFF + CHANGE_LEDGER + live infrastructure must still be sufficient to continue.

## 10. If a session is about to end normally

Follow `docs/HANDOFF_TEMPLATE.md`.

Required order:

1. finish or explicitly stop the current logical unit
2. commit every completed logical source unit
3. ensure every meaningful source commit has one CHANGE_LEDGER entry
4. update each touched ledger entry to latest DB/Edge/deployment/verification state
5. reconcile local workspace according to `docs/WORKSPACE_PROTOCOL.md`
6. verify current branch/main HEAD
7. verify DB/Edge/deployment state relevant to the session
8. update `PROJECT_STATE.md` only if durable architecture changed
9. prepend one session-level entry to `DEVELOPMENT_LOG.md`
10. replace `HANDOFF.md`
11. commit these handoff documents as the final session commit
12. re-read the final HANDOFF and CHANGE_LEDGER from GitHub to ensure both are retrievable

## 11. If the session was interrupted unexpectedly

The next session should not trust chat history, blindly trust HANDOFF, or blindly trust a surviving mount.

Recovery algorithm:

1. read HANDOFF's last known branch and commits
2. query current GitHub `main`
3. inspect newer commits
4. read CHANGE_LEDGER and map meaningful source commits to entries
5. reconstruct any missing entry before beginning new independent work
6. inspect recorded work branch, if one exists
7. query Supabase migration history
8. query relevant Edge Functions
9. query `deploy_control_state`
10. only then inspect any surviving `/mnt/data/research-align` using `docs/WORKSPACE_PROTOCOL.md`
11. create a state table:

```text
change | source committed | ledger recorded | DB applied | edge deployed | app deployed | behavior verified | local-only state
```

12. preserve/classify local-only commits or uncommitted changes before destructive workspace commands
13. continue from the newest known-good checkpoint

If a commit exists but was never verified, test it before adding more changes on top.

## 12. Handoff quality standard

A good handoff lets the next agent answer these without asking the user:

- Which branch should I continue?
- What is the exact HEAD?
- Is there unfinished work?
- What was the last verified commit?
- Which meaningful source commits were made in the last session and why?
- Which CHANGE_LEDGER entry maps to each source commit?
- Which migrations are live?
- Which Edge Functions changed?
- What commit is production actually running?
- What tests passed/failed?
- Is any temporary probe still live?
- What workspace mode was used?
- If a local checkout existed, was its origin/branch/HEAD/dirty state verified?
- Is there any local-only state that would be lost if `/mnt/data` disappears?
- Is the current mount safe to lose?
- What is the single next action?

If any answer is ambiguous, improve the handoff before closing the session.

## 13. Recommended new-session instruction

The user should be able to say only:

> Continue `stpcoder/research-align`. Read root `AGENTS.md` and follow its session-start procedure. Recover the exact current state from GitHub, `docs/HANDOFF.md`, `docs/WORKSPACE_PROTOCOL.md`, `docs/CHANGE_LEDGER.md`, and live Supabase deployment state. Verify or rehydrate `/mnt/data/research-align` if possible; otherwise use connector-only mode. Then continue the work recorded in HANDOFF.

That is the target operating model.
