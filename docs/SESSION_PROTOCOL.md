# Research Align — Cross-Session Development Protocol

This is the concrete operating procedure for development that may span many ChatGPT/Codex conversations.

The objective is simple: at any moment, a new session should be able to determine exactly what is committed, what is live, what is verified, and what remains.

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
```

A feature is complete only when every state relevant to it is explicitly known.

## 2. Session start — mandatory preflight

### Step 1: read repository memory

Read:

1. `AGENTS.md`
2. `docs/HANDOFF.md`
3. `docs/PROJECT_STATE.md`
4. this file
5. additional domain docs relevant to the request

### Step 2: establish the live baseline

Verify at least:

- GitHub current `main` HEAD
- active work branch from HANDOFF, if any
- commits newer than HANDOFF's recorded checkpoint
- Supabase project health when DB work is involved
- latest applied migrations when DB work is involved
- `deploy_control_state` for `research-align`
- production deployed commit + deployment ID/status

Write down discrepancies before editing.

### Step 3: classify the requested work

Choose one:

- small verified fix/change → direct `main` may be acceptable
- multi-step/risky/refactor/migration-heavy work → use `work/YYYYMMDD-<topic>`
- investigation only → do not mutate production/source unnecessarily

State which invariants may be affected: scheduling, contact state, email, RLS/security, deployment, or public participant flow.

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

### 3.3 Implement atomically

A logical change can span multiple files. Keep them in one commit when they must move together.

Typical feature commit may include:

```text
src/components/...
src/lib/types.ts
supabase/migrations/...
supabase/functions/...
tests or verification helpers
```

Do not create arbitrary one-file commits if that makes an intermediate commit internally inconsistent.

### 3.4 Verify before commit

Run the strongest practical checks for the surface changed:

- TypeScript/Next build or type checking
- lint where meaningful
- targeted DB query/function invocation
- constraint/trigger definition inspection
- Edge Function invocation
- UI/E2E path

Record what was actually checked, not what was intended.

### 3.5 Commit immediately after a verified logical checkpoint

Use a descriptive conventional commit.

```text
feat(schedule): add researcher-wide conflict visibility
fix(contact): preserve pending state after schedule email
db(schedule): include buffer in public busy intervals
ops(mail): disable cancellation probe
docs(handoff): record mail retry rollout
```

Then record the commit SHA in the working notes/HANDOFF when the session closes.

### 3.6 Start the next independent change only after the previous one is committed

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

1. commit each verified checkpoint
2. keep HANDOFF updated with branch + HEAD if the session ends
3. next session continues that exact branch
4. complete build/tests
5. integrate into `main`
6. deploy only the intended `main` commit

Never abandon a recorded work branch and recreate the same work from memory without inspecting it first.

## 5. Database rollout protocol

### Normal backward-compatible change

Preferred order:

1. implement source + migration
2. commit the logical change
3. apply migration to Supabase
4. verify live DB definition
5. deploy the exact application commit
6. production E2E

### Breaking change

Use expand/deploy/contract:

#### Commit A — expand

Add backward-compatible column/function/constraint behavior.

Apply and verify DB.

#### Commit B — application

Switch application to new shape.

Deploy and verify.

#### Commit C — contract

Only after production verification, remove old shape/compatibility.

This prevents a deployment or DB failure from leaving application and database mutually incompatible.

### Migration bookkeeping

HANDOFF must list:

- migration file/name
- committed SHA containing it
- whether it is applied in production
- live verification performed

Never rely only on “the SQL was run”.

## 6. Edge Function rollout protocol

For every changed function record:

- slug
- intended auth model (`verify_jwt` true/false + custom authentication if false)
- deployed version if available
- invocation test result

Temporary functions/probes must have an explicit cleanup line in HANDOFF.

A probe is not finished until it is either deleted or returned to the accepted disabled state (`verify_jwt=true`, HTTP 410) where applicable.

## 7. Production application deployment protocol

Research Align's primary path is the Supabase Vercel control plane; do not replace it with a new Vercel project.

Before deployment:

- identify exact intended `main` commit
- confirm no unrelated unverified commits are being accidentally included
- confirm required DB changes are in the correct rollout state

After deployment query `deploy_control_state` and record:

- project ID
- deployment ID
- status
- production URL
- `details.commitSha`
- timestamp

The deployment is not considered verified merely because Vercel says READY. Test the relevant production behavior.

## 8. Runtime commit vs documentation HEAD

The final handoff documentation commit often makes GitHub `main` newer than the deployed application SHA.

That is allowed when the difference is documentation/tooling only.

HANDOFF must explicitly distinguish:

```text
main_head: <latest repo commit>
last_runtime_commit: <latest commit that changes deployed runtime behavior>
production_commit: <commit recorded by deploy_control_state>
```

If `last_runtime_commit != production_commit`, explain why. Never leave unexplained runtime drift.

## 9. If a session is about to end normally

Follow `docs/HANDOFF_TEMPLATE.md`.

Required order:

1. finish or explicitly stop the current logical unit
2. commit every completed logical unit
3. verify current branch/main HEAD
4. verify DB/Edge/deployment state relevant to the session
5. update `PROJECT_STATE.md` only if durable architecture changed
6. prepend one entry to `DEVELOPMENT_LOG.md`
7. replace `HANDOFF.md`
8. commit these handoff documents as the final session commit
9. re-read the final HANDOFF from GitHub to ensure it is retrievable

## 10. If the session was interrupted unexpectedly

The next session should not trust chat history or blindly trust HANDOFF.

Recovery algorithm:

1. read HANDOFF's last known branch and commits
2. query current GitHub `main`
3. inspect newer commits
4. inspect recorded work branch, if one exists
5. query Supabase migration history
6. query relevant Edge Functions
7. query `deploy_control_state`
8. create a state table:

```text
change | source committed | DB applied | edge deployed | app deployed | behavior verified
```

9. continue from the newest known-good checkpoint

If a commit exists but was never verified, test it before adding more changes on top.

## 11. Handoff quality standard

A good handoff lets the next agent answer these without asking the user:

- Which branch should I continue?
- What is the exact HEAD?
- Is there unfinished work?
- What was the last verified commit?
- Which commits were made in the last session and why?
- Which migrations are live?
- Which Edge Functions changed?
- What commit is production actually running?
- What tests passed/failed?
- Is any temporary probe still live?
- What is the single next action?

If any answer is ambiguous, improve the handoff before closing the session.

## 12. Recommended new-session instruction

The user should be able to say only:

> Continue `stpcoder/research-align`. Read root `AGENTS.md` and follow its session-start procedure. Recover the exact current state from the repository and live Supabase deployment state, then continue the work recorded in `docs/HANDOFF.md`.

That is the target operating model.
