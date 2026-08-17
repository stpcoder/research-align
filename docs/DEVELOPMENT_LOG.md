# Research Align — Development Log

This is the append-only chronological development history for AI-agent and developer sessions.

Rules:

- Add new entries at the top, below this header.
- Do not rewrite old entries just to make the story cleaner.
- Keep entries factual: what changed, what was verified, important regressions/bugs, and relevant commit/migration/deployment references.
- Put only durable history here. The immediate next action belongs in `docs/HANDOFF.md`.
- Never include secret values.

---

## 2026-08-17 KST — Shared admin primitive system completed across researcher pages

### Goal

Make researcher UI consistency structural rather than cosmetic: equivalent buttons, inputs, dropdowns, rows, status badges, metrics, tables, dividers, and typography should be the same implementation across Home, 신청서, 신청자, 일정, and 연락.

The explicit design constraints were:

- remove low-value tiny microcopy
- reduce card/box accumulation
- avoid left-edge-only state decoration
- centralize border/divider thickness, font family, and type scale
- keep domain-specific components specialized only when their interaction is genuinely unique

### Foundation and earlier migrations — CHANGE-013 through CHANGE-016

The first phase established the shared admin foundation and migrated participant/contact surfaces:

- `6c35064df79111d37fc1f3c48abd24f06ed6f3be` — shared admin design foundation
- `8c2c6578b3175a9a170677768f647d639c6d7acf` — participant page migration
- `6a80a9f08e3aa97fcbf0f97c17dc782b0317c212` — Contact migration
- `8c4a7872f24b73410f0650ba064cc7a1c90c27e3` — legacy visual conflict cleanup

The combined state was production-built as exact SHA `fdb0e31ae2c139abbc71e9b179628b140ebd7ba2` on deployment `dpl_ArkQh4QUyjMG1ehnrR99WrAcVnhG` through deploy-control job `6dc462a6-cc4a-41af-8b6e-aa499d047fa2` / request `124`.

### CHANGE-20260817-017 — complete Home/Form/Schedule primitive migration

Source commit:

- `a1741845de378eeef85308e74298d34850acefb3` — `refactor(ui): complete shared admin primitive migration`

The source was deliberately squashed to one commit directly on the prior production baseline `fdb0e31...`; an intermediate Home-only checkpoint was removed from the work-branch history and is not part of the durable change sequence.

#### Shared component ownership

`src/components/admin/AdminUI.tsx` now owns generic researcher primitives including:

- buttons, link buttons, icon buttons
- inputs, selects, textareas, fields
- page/section/panel headers
- surfaces, split views, dividers
- status badges and selectable list rows
- menu rows and action rows
- data rows and tables
- metric strips

#### Shared visual tokens

`src/app/admin-foundation.css` owns:

- shared font family
- explicit 1px structural line/divider token
- normal/strong line colors
- page/section/panel/body/label/meta type roles
- surface radius/padding
- button/control heights and radii
- list/table/data-row geometry
- selected full-surface treatment
- compatibility aliases for remaining legacy class names

Routine metadata is 12px. 11px is reserved for a real kicker/index role; routine 10px helper text is not part of the normal system.

#### Home

- page actions/status/metrics/agenda moved to shared primitives
- top four metrics are one strip separated by 1px dividers instead of four cards
- per-study operational counters are quiet text actions rather than another four-box grid
- upcoming sessions use shared action rows
- stop-before-delete behavior now lives directly in canonical `ResearchHome.tsx`

#### Form Builder

- generic fields, inputs, selects, textareas, actions, icon buttons, and add-menu rows use shared primitives
- removed always-visible `저장됨`, question-number microcopy, repeated section explanations, date-pill boxes, boxed required-state copy, and redundant option descriptions
- option editing uses divider rows rather than one rounded box per option
- blackout cells remain specialized because drag-paint behavior is domain-specific
- publish-save callback now lives directly in canonical `FormBuilderUnified.tsx`

#### Schedule

- participant search/filter, page/panel actions, date navigation, assignment actions, coordination actions, and confirm actions use shared primitives
- session selector and timetable cells remain specialized because they encode scheduling state
- specialized schedule cells still consume the same typography and 1px line tokens

### Build-time mutation reduction

`scripts/prebuild-ui-copy.mjs` no longer patches:

- ResearchHome stop-before-delete behavior
- FormBuilder publish-save callback

It still owns the legacy top-level `page.tsx` / StudyWorkspace compatibility transformation and date-window safety replacement. Removing that remaining mutation is still technical debt.

### Production rollout

The exact `main` snapshot including the CHANGE-017 ledger entry was deployed:

- deployed SHA: `dfb8a7796b90bce663a8e48fcf90296cd1857ad0`
- deploy-control job: `3e3d7508-73d9-4eb6-a2e2-cfe3557a9280`
- request: `125`
- Vercel deployment: `dpl_HcfM9jkpgDoSmXpfwDu4VCpgCrJv`
- Vercel status: `READY`
- production URL: `https://research-align.vercel.app`
- snapshot source: `github-codeload`

The READY deployment verifies the Next.js/TypeScript production build for the complete shared primitive migration.

### Backend impact

- no database migration
- no PostgreSQL trigger/RPC/RLS change
- no Edge Function change
- ClawMail and schedule-notify contracts unchanged

### Verification boundary

This remained a connector-only session with no trusted local checkout and no authenticated researcher browser context.

Verified:

- source/ledger commit history
- exact intended file diff
- deploy-control job success
- Vercel READY
- exact production SHA
- Next.js/TypeScript production build

Not run:

- authenticated visual inspection of Home/Form/Applicant/Schedule/Contact
- authenticated click-through of the complete participant-centered workflow

The next UX action is therefore a visual/click audit with realistic long values. Only concrete hierarchy, overflow, line-alignment, or state-confusion findings should result in further UI changes; do not add decorative layers merely for polish.

---

## 2026-08-17 KST — Contact schedule context added while simplifying the messaging UI

### Goal

Complete the next participant-centered UX layer without turning Contact into another schedule dashboard.

The design constraint for this work was explicit: useful context should be added only if it removes task switching, while redundant copy, nested cards, decorative state boxes, and left-edge-only highlights should be avoided.

### CHANGE-20260817-011 — compact schedule context inside Contact

Source commit:

- `86e321f56db888a30dca57ec4b69bcee345eb07a` — `feat(contact): show compact schedule context`

Behavior:

- Contact now loads current-study assignments with participants and contact threads
- the selected matched participant's conversation shows one inline `일정` section
- every configured session is one compact row: session name, current assignment time or submitted availability preview, semantic status
- unassigned availability is ordered by preference rank
- at most three candidate slots are displayed; additional slots collapse to `+N`
- the detailed timetable remains in Schedule via `일정 보기`
- the context is separated with normal horizontal dividers inside the existing conversation surface; no nested card or colored side rail was added

### CHANGE-20260817-012 — Contact chrome/copy reduction

Source commit:

- `283065e65869da26b174470dc76edd8563a20aeb` — `feat(contact): simplify messaging chrome`

Behavior:

- removed the multi-line mailbox status panel and status dot
- connected mailbox UI is reduced to address, useful last-sync time, and one sync action
- disconnected state is one `연구용 이메일 연결` action
- removed duplicate `대기 / 답변 필요 / 새 문의 / 응대 중` wording; pending is represented once as `답변 필요`
- shortened source/navigation labels and empty-state copy
- successful send UI no longer exposes provider-return status text
- removed duplicate recipient email from the composer footer
- kept one clear primary composer action: `이메일 보내기`

### Production rollout

The exact current main snapshot after both source changes and their initial ledger entries was deployed:

- deploy source SHA: `a077cb8f0164df9a979cf6f7347e10b0917978dc`
- deploy-control job: `0abc2c43-a852-47ea-aaf0-057014db2653`
- pg_net request: `123`
- Vercel deployment: `dpl_ACQXqHwb12F6K2mfp4ucAcczamT6`
- job status: `succeeded`
- Vercel state: `READY`
- production URL: `https://research-align.vercel.app`
- snapshot source: `github-codeload`

The READY deployment verifies the Next.js/TypeScript production build for both Contact changes.

### Backend impact

- no database schema migration
- no trigger/RLS/function change
- no Edge Function change
- ClawMail and schedule-notify contracts unchanged
- existing assignments are read by Contact; scheduling writes/invariants remain in the Schedule/DB path

### Verification boundary

This remained a connector-only session with no authenticated researcher browser context.

Verified:

- source commits and ledger mappings
- deploy-control job success
- exact deployed SHA
- Vercel READY production build

Not run:

- authenticated visual inspection of the Contact conversation
- clicking between Contact and Schedule in a researcher session
- actual mailbox send/sync operations during this UX change

### Durable UI principle

For researcher/admin UI, continue to prefer:

- one clear task/action per region
- spacing, typography, dividers, and subtle full-surface selection before decoration
- short task-oriented copy
- one representation of a state rather than multiple synonymous labels

Avoid using a colored left border as the only status/selection signal, and avoid creating another card simply because a new piece of contextual data is added.

---

## 2026-08-17 KST — Researcher participant-coordination UX P0 completed

### Goal

Rework the researcher experience around the real operational unit — one participant — rather than making `신청자`, `일정`, and `연락` behave like isolated tools.

The implementation focused on three P0 UX problems identified in the preceding audit:

1. preserve the same participant while moving between applicant detail, scheduling, and contact
2. make schedule modification/status actions explicit and safer
3. replace implementation-oriented direct scheduling with a researcher-facing time-coordination decision flow

### CHANGE-20260817-008 — shared participant context

Source commit:

- `c9f20ca7d63fc1e734e597119113fdfdd93f2ac2` — `feat(ops): preserve participant context across tabs`

Behavior:

- active participant is stored in `?participant=<response_id>`
- applicant, schedule, and contact restore that participant on mount
- participant selection updates the shared URL context
- applicant detail exposes `일정 조율하기` and `연락하기`
- schedule exposes `이 참가자에게 연락`
- contact exposes `일정에서 보기` and `신청 내용`
- unmatched public inquiry selection clears participant context
- StudyWorkspace listens for `studyform:navigate` and changes tabs without losing the participant query parameter

New helper:

- `src/lib/researcherNavigation.ts`

### CHANGE-20260817-009 — schedule action hierarchy and safety

Source commit:

- `f78ff1c4a1a6bfb9830be11f5086d8037cd59b79` — `feat(schedule): clarify schedule action hierarchy`

Behavior:

- a confirmed schedule cannot be accidentally replaced by clicking another timetable cell
- the researcher must first enter explicit `시간 변경` mode
- the old assignment remains intact until the replacement is explicitly confirmed
- primary confirm labels now communicate the email side effect: `일정 확정하고 안내 보내기` / `일정 변경하고 안내 보내기`
- future sessions do not show `완료/불참` as routine actions
- `완료 처리` / `불참 처리` appear after the session end time
- `일정 취소` is destructive
- failed schedule-mail retry becomes the primary recovery action

### CHANGE-20260817-010 — participant time coordination flow

Source commit:

- `70af27d5fb1feafc748749ecf630c17116027f82` — `feat(schedule): add participant time coordination flow`

Behavior:

- `직접 협의한 시간 지정` was replaced by `다른 시간 조율하기`
- opening coordination does not immediately unlock arbitrary empty cells
- the researcher chooses one of:
  - `이메일로 시간 협의` → Contact for the same participant
  - `이미 합의한 시간이 있음` → explicit agreed-time selection mode
- UI language now says `별도 합의` / `합의한 시간` while preserving the database audit value `scheduling_source = admin_agreed`
- change mode, coordination-choice mode, and agreed-time selection mode are mutually exclusive and reset together

### Production rollout

After all three source commits and their individual ledger entries were present, the exact current main snapshot was deployed:

- deploy source SHA: `a68c2439c66ecd663466a746adb37f085f5c57c0`
- deploy-control job: `f89494c6-a62b-4d73-bc31-48fbb36da4bd`
- pg_net request: `122`
- Vercel deployment: `dpl_G74DQabUEgvmCQsxXezPdbuhs7ef`
- job status: `succeeded`
- Vercel state: `READY`
- production URL: `https://research-align.vercel.app`
- `deploy_control_state.details.commitSha`: `a68c2439c66ecd663466a746adb37f085f5c57c0`
- `deploy_control_state.details.snapshotSource`: `github-codeload`

The successful Vercel build verifies the Next.js/TypeScript production build including the build-time `StudyWorkspace` navigation patch.

### Verification boundary

This session remained `connector-only`; there was no trusted local checkout and no authenticated researcher browser session.

Therefore:

- production build / READY / exact SHA: verified
- authenticated cross-tab clicks, schedule-change clicks, and coordination clicks: **not browser-automated in this session**
- no claim is made that those authenticated click flows were E2E-tested

A direct environment fetch also could not resolve the production hostname from the sandbox DNS; this does not conflict with the Vercel READY/control-plane result but prevents an independent curl smoke check here.

### Durable product state / next UX layer

`docs/PROJECT_STATE.md` records participant-centered navigation, explicit change mode, time-aware completion/no-show actions, and the two-branch coordination flow.

---

## 2026-08-17 KST — Stop-before-delete, publish autosave, and deployment control recovery

### User-facing goals

Two reported researcher workflow problems were addressed:

1. Published studies should be stopped before permanent deletion, with an obvious `모집 중지 -> 삭제` lifecycle.
2. Publishing a newly created/edited study should automatically save unsaved Form Builder changes first, so returning home after `모집 시작` does not leave the public study on stale form configuration.

### CHANGE-20260817-004 — stop before delete

Source commit:

- `19a3d9dbd51040d55d9617485f212f4597231447` — `fix(study): require stop before delete`

Behavior:

- `published -> 모집 중지 -> closed`
- a published study cannot be deleted directly
- once closed, the home action becomes `삭제`
- permanent deletion still requires typing the exact study title
- closed studies can be reopened with `모집 재개`

### CHANGE-20260817-005 — save before publishing

Source commit:

- `1bde332ad88126b2eceb5361243c392be960466e` — `fix(form): save changes before publishing`

Behavior:

- Form Builder exposes its existing `save()` operation to the workspace while mounted
- `모집 시작` / `모집 재개` first save dirty form state
- publishing waits for dirty state to clear
- if save/validation fails and dirty state remains, publishing is aborted rather than exposing stale persisted data
- stopping a currently published study does not force an unrelated save

Both product fixes currently flow through `scripts/prebuild-ui-copy.mjs`, consistent with the existing production architecture. Removing build-time source mutation remains separate technical debt.

### Deployment incident: GitHub REST rate limit

The first production deployment job for the new changes was:

- job `e0bf2301-cb19-455e-bfd4-c9055df98ec1`
- pg_net request `119`

It failed before source snapshot creation because the live `vercel-control` function was reading the public repository through unauthenticated GitHub REST APIs from a shared Supabase egress IP. GitHub returned `API rate limit exceeded`.

The stale job row initially remained `running`; after confirming request 119's HTTP 500 result it was corrected to `failed` with the actual rate-limit reason.

### CHANGE-20260817-006 — exact-SHA codeload fallback

Source commit:

- `37d1be727d73824abd7d3b10b47023a78b8da5b6` — `ops(deploy): add codeload snapshot fallback`

Changes:

- source-controlled the previously live-only `vercel-control` function at `supabase/functions/vercel-control/index.ts`
- added deterministic exact-SHA snapshot download through `codeload.github.com` when deploy manifest contains `commitSha`
- retained GitHub REST snapshot mode for compatibility when no exact SHA is supplied
- recorded `snapshotSource` in `deploy_control_state`

Live `vercel-control` v3 was deployed with this fallback.

### First codeload attempt and parser bug

Exact-SHA deployment using v3 successfully bypassed GitHub REST rate limiting and created a Vercel deployment:

- job `f4dbac77-d196-47ea-8e86-9edc81a2a84e`
- pg_net request `120`
- deployment `dpl_2x8TvtPSYyDCvZXT3mcx3P2PhJrk`

Vercel then failed build with:

- status `ERROR`
- code `missing_pages_app`
- `npm run vercel-build` exit 1

The root cause was archive root normalization in the first tar parser, not the application feature changes.

### CHANGE-20260817-007 — codeload root normalization

Source commit:

- `69bc18301e6964c04dfccefc40a0c88a7365a0b7` — `fix(deploy): normalize codeload archive root`

Changes:

- switched tar parsing to collect regular files first and strip the common root in a second pass
- added an explicit `package.json` presence guard before Vercel deployment creation

Live `vercel-control` was upgraded to **version 4**, status ACTIVE, `verify_jwt=false` with the existing custom high-entropy `controlKey` authentication.

### Successful production rollout

The corrected exact-SHA deployment used:

- job `5f82cd22-5b48-4843-be49-7ec9e075a546`
- pg_net request `121`
- exact source SHA `79dfc2cd0777031a2d64f2dda734e30b98d1fe1f`

Result:

- job status: `succeeded`
- Vercel deployment: `dpl_namA9eDG4cEDWMDEqhwx8exTLxXZ`
- Vercel state: `READY`
- production URL: `https://research-align.vercel.app`
- `deploy_control_state.details.commitSha`: `79dfc2cd0777031a2d64f2dda734e30b98d1fe1f`
- `deploy_control_state.details.snapshotSource`: `github-codeload`

This successful Vercel build also verifies that the build-time source transformation containing CHANGE-004 and CHANGE-005 is syntactically/build valid in production.

### Verification boundary

Authenticated researcher browser click-flow E2E was **not** available in this connector-only session. Therefore the actual clicks `모집 시작`, `모집 중지`, and `삭제` were not browser-automated here. This limitation is explicitly preserved in CHANGE_LEDGER/HANDOFF rather than being described as tested.

### Documentation / durable state

- `CHANGE-20260817-004` through `CHANGE-20260817-007` were recorded individually
- rollout state for all four entries was updated after the READY deployment
- `docs/PROJECT_STATE.md` was updated to reflect the new study lifecycle, publish autosave, source-controlled `vercel-control`, and exact-SHA codeload path
- workspace remained `connector-only`; no local-only source state is being carried forward

---

## 2026-08-17 KST — Cross-session workspace rehydration protocol established

### Goal

Make local workspace handling deterministic across ChatGPT/Codex conversations without assuming `/mnt/data` persists between sessions.

The user requirement was to make development feel continuous across sessions while keeping GitHub—not a sandbox filesystem—as the durable source of truth.

### Meaningful source/process commit

- `4fcea25458897f5ddd5a86f56c661d45f1b7e91f` — `docs(dev): add workspace rehydration protocol`
  - added `docs/WORKSPACE_PROTOCOL.md`
  - updated root `AGENTS.md`
  - updated `docs/SESSION_PROTOCOL.md`
  - updated `docs/HANDOFF_TEMPLATE.md`
  - created all four protocol changes as one atomic Git tree/commit

### Granular ledger

- `CHANGE-20260817-003` maps to source commit `4fcea25458897f5ddd5a86f56c661d45f1b7e91f`
- `bea86b8647dd9093a9f9bd73efe95dbf0a5a22f0` — `docs(ledger): record workspace rehydration protocol`
  - bookkeeping-only commit; exempt from receiving another ledger entry

### Durable workspace rules established

- preferred logical workspace path is `/mnt/data/research-align`
- that path is explicitly non-durable and must never be trusted merely because it exists
- sessions first recover expected branch/HEAD from GitHub/HANDOFF
- existing checkout reuse requires verified origin, branch, HEAD, and dirty state
- dirty/locally-ahead checkouts are treated as recovery material; destructive reset/clean/delete is forbidden until state is preserved/classified
- a missing checkout is rehydrated when normal Git network access exists
- when shell Git network access is unavailable, the session declares `connector-only` mode and uses GitHub connector/tree/commit APIs rather than pretending a full checkout exists
- `partial-scratch` mode is distinguished from a complete checkout
- dependencies, caches, shell state, local env, and secrets are not considered durable
- build-time `scripts/prebuild-ui-copy.mjs` mutation must be checked before/after local build/dev
- completed logical changes must become GitHub commits promptly; the mount alone never counts as durable completion
- HANDOFF now records workspace mode, local-only state, and `safe_to_lose_current_mount`
- normal end state is `local_only_state = none` and `safe_to_lose_current_mount = yes`

### Environment finding during verification

A direct shell `git clone` test failed with:

`Could not resolve host: github.com`

The GitHub connector remained usable, so the current session was correctly classified as `connector-only`. The failed clone left no checkout behind, and the canonical `/mnt/data/research-align` path was absent at final reconciliation.

This real environment constraint is exactly why the protocol includes a connector-only fallback.

### Production state

- no application runtime code changed
- no Supabase schema/function/RLS change occurred
- no Edge Function changed
- no production deployment was triggered
- live `deploy_control_state` remained `READY`
- production deployment remained `dpl_AcPUSSgYSPxbhkVtK99BKACtTyQ5`
- production runtime commit remained `dd5eab06280f78f37d5926f4d940ef697c04d4b0`

---

## 2026-08-17 KST — Granular one-change-at-a-time ledger made mandatory

### Goal

Strengthen cross-session recoverability so future development records every meaningful logical modification individually, not only as a session summary.

### Meaningful source/process commits

- `2e475a880495575de41376a3fde786ae7f749abd` — `docs(dev): add granular change ledger`
  - created `docs/CHANGE_LEDGER.md`
  - established one logical change = one ledger entry
- `d8b63b1ef32de06afacea97208910e889fdf4a3f` — `docs(dev): require per-change ledger entries`
  - made the ledger mandatory in `AGENTS.md`
  - updated `docs/SESSION_PROTOCOL.md`
  - updated `docs/HANDOFF_TEMPLATE.md`
  - added interrupted-session recovery for commits missing a ledger entry

### Ledger bookkeeping

- `CHANGE-20260817-001` maps to `2e475a...`
- `CHANGE-20260817-002` maps to `d8b63b...`
- `efeddbd5ad89604c8000040ffbfb0c279e3b6c71` — `docs(ledger): record protocol enforcement`
  - bookkeeping-only commit; exempt from receiving another ledger entry

### Durable rule established

The required cycle for future meaningful development is now:

```text
logical change
-> verification checkpoint
-> atomic source commit
-> one CHANGE_LEDGER entry referencing exact source SHA
-> ledger bookkeeping commit
-> only then next independent logical change
```

DB migration, Edge Function, provider, Vercel deployment, and E2E state are attached to the same Change ID as rollout progresses.

Pure ledger and final handoff bookkeeping commits are exempt from their own ledger entries to prevent recursive logging.

### Verification

- confirmed `main` baseline before the new ledger was `c42c98e71e0b742e5eb41053830da3c7b70a88b4`
- confirmed `2e475a...` added the ledger
- created policy commit `d8b63b...` and fast-forwarded `main`
- committed `CHANGE-20260817-002` bookkeeping as `efeddbd...`
- re-queried live Supabase `deploy_control_state`
- production remained `READY` on deployment `dpl_AcPUSSgYSPxbhkVtK99BKACtTyQ5`
- production runtime commit remained `dd5eab06280f78f37d5926f4d940ef697c04d4b0`
- no production deployment was triggered because these were development-process documentation changes only

---

## 2026-08-16 KST — Cross-session commit and recovery protocol hardened

### Goal

Turn the repository from a passive handoff document store into an explicit operating system for development across many ChatGPT/Codex conversations.

The user requirement was that completed modifications be committed reliably and that a new conversation be able to continue immediately without reconstructing context from old chat history.

### Commit

- `babaa5dde98921299e79bff9fd1040cbb4ecb6b5` — `docs(dev): establish cross-session commit protocol`

This was deliberately created as one atomic multi-file commit using a Git tree because all three documentation changes form one logical development-process feature.

### Changed

- strengthened root `AGENTS.md`
  - one logical change per commit
  - atomic multi-file commit rule
  - commit completed checkpoints promptly
  - direct-main rule for small verified fixes
  - `work/YYYYMMDD-<topic>` branch rule for large/risky/multi-session work
  - conventional commit categories
  - DB migration/source synchronization rules
  - expand/deploy/contract guidance for breaking DB changes
  - final handoff as its own commit
  - interrupted-session recovery procedure
- added `docs/SESSION_PROTOCOL.md`
  - explicit five-state model: source / DB / Edge Function / app deployment / behavior verification
  - mandatory session preflight
  - repeatable logical work-item loop
  - branch strategy
  - DB and Edge rollout procedure
  - production deployment verification
  - crash/interruption recovery algorithm
- added `docs/HANDOFF_TEMPLATE.md`
  - exact branch/commit/runtime/deployment fields
  - in-progress boundary
  - migrations and Edge Function tables
  - verification evidence
  - source/deployment drift explanation
  - exact next action
  - recovery instructions

### Verification

- confirmed `main` before the protocol commit was `079fe2d51eb2d91d603fa06a70dc5896b6e2d9cd`
- created the protocol changes as one Git tree and commit
- fast-forwarded `main` to `babaa5dde98921299e79bff9fd1040cbb4ecb6b5`
- re-read branch metadata and confirmed `main` points to `babaa5...`
- re-queried live Supabase `deploy_control_state`
- confirmed production remained `READY` on deployment `dpl_AcPUSSgYSPxbhkVtK99BKACtTyQ5`
- confirmed production still ran runtime commit `dd5eab06280f78f37d5926f4d940ef697c04d4b0`
- no production deployment was triggered because the changes are repository-process documentation only

### Durable operating rule established

Every future session should lose at most the currently incomplete logical unit if interrupted. Every completed independent change should already exist as a retrievable Git commit before the next independent change begins.

---

## 2026-08-16 KST — Persistent multi-session development handoff established

### Goal

Make the repository itself sufficient context for future ChatGPT/Codex sessions so development can continue across conversation boundaries without relying on old chat history.

### Added

- root `AGENTS.md`
  - session-start reading order
  - source-of-truth hierarchy
  - deployment-control rules
  - build-time rewrite warning
  - scheduling/database invariants
  - ClawMail/contact boundaries
  - security rules
  - mandatory session-end documentation protocol
  - recommended prompt for future sessions
- `docs/PROJECT_STATE.md`
  - durable architecture and feature inventory
  - production topology
  - scheduling/contact/email/deployment behavior
  - known technical debt and hardening backlog
- `docs/DEVELOPMENT_LOG.md`
  - this append-only history
- `docs/HANDOFF.md`
  - rolling latest-session handoff for the next agent/session

### Baseline verified before writing the documentation

- application/runtime code baseline: `dd5eab06280f78f37d5926f4d940ef697c04d4b0`
- commit message: `Fix date window type check`
- production deployment for that code: `dpl_AcPUSSgYSPxbhkVtK99BKACtTyQ5`
- production status: `READY`
- production URL: `https://research-align.vercel.app`
- production deployment state recorded the same code SHA, `dd5eab...`
- Supabase project: `rgwqsqeikebwunbdnbex`, healthy in `ap-northeast-1`

Documentation commits made after `dd5eab...` move GitHub `main` forward without changing the application runtime code. Future sessions must always query the actual current HEAD and `deploy_control_state` rather than assuming the SHA in an old log entry is still current.

### Important state discovered/reconfirmed

- Earlier handoff text that called `c010fab...` the current HEAD was stale. Two later application commits existed:
  - `a33d2cefe7a16982b3ffdc33a54a4d2b56bf30a8` — range scheduling and study lifecycle controls
  - `dd5eab06280f78f37d5926f4d940ef697c04d4b0` — date-window type-check fix
- Features previously listed as future work were already implemented:
  - 4-date scheduling window
  - unsaved-change warning
  - session location
  - participant instructions
  - session buffer time
  - date-range / 7-day form-builder controls
  - permanent study deletion with typed-title confirmation
- production DB had the latest `buffer_aware_schedule_conflicts` migration applied.
- owner-wide public busy interval behavior remained verified with an example where one study had 5 own busy intervals while owner-wide busy intervals returned 11.
- no study `form_config` contained SMS/문자 안내 copy at verification time.
- Google Calendar functions were confirmed to be disabled HTTP 410 stubs.
- direct production/probe functions used during testing were confirmed disabled behind JWT + HTTP 410 stubs, including `direct-prod-deploy`, `ops-cancel-probe`, and `range-delete-deploy-probe`.
- ClawMail is the live email transport; Supabase contact tables remain the communication source of truth.
- Vercel connector visibility did not match the operational deployment credential scope; Supabase `deploy_control_state` is the required reference before any project-level Vercel action.
- `main` had no branch protection or required checks.
- build-time `scripts/prebuild-ui-copy.mjs` remains a major maintenance caveat because it rewrites `src/app/page.tsx` before dev/build.

### Known risks carried forward

- ClawMail runtime send quota needs resolution before real participant-scale operation.
- build-time source rewriting should eventually be removed.
- branch protection / CI gates are absent.
- stale KeyID-era docs/config and legacy/probe infrastructure remain.
- Supabase advisor findings need review/minimal hardening.
- production still contains demo/test data.

---

## 2026-08-16 KST — Multi-study operations and buffer-aware scheduling completed

### Key application commits

- `92013f5aab948b8fb535601d2040c0e72db3e31f` — `Improve multi-study research operations`
- `c010fab18da545118cdc4f26c6e08c99cc074cc8` — `Allow schedule cancellation notifications`
- `a33d2cefe7a16982b3ffdc33a54a4d2b56bf30a8` — `Add range scheduling and study lifecycle controls`
- `dd5eab06280f78f37d5926f4d940ef697c04d4b0` — `Fix date window type check`

### Major product changes

- researcher home converted into an operational dashboard with:
  - today schedule count
  - unscheduled participant count
  - reply-needed count
  - mail-failure count
  - per-study action counters
  - cross-study upcoming agenda
- schedule workspace changed from study-local collision handling to researcher-owner-wide collision handling.
- participant public busy intervals expanded to include all studies owned by the researcher.
- assignment lifecycle standardized around confirmed/completed/no_show/cancelled.
- cancellation stopped deleting assignment rows and instead preserves `cancelled` history.
- schedule cancellation notification kind added to the database constraint and email function.
- participant scheduling list gained search and lifecycle filters.
- contact UI gained search, pending-first sorting, automatic schedule-mail labels, and corrected pending/open/closed semantics.
- schedule automatic messages no longer clear a pending participant inquiry.
- SMS-oriented form expectations were removed from study forms.
- form builder gained date ranges, session location/instructions/buffer, and dirty-state warning.
- schedule collision logic became buffer-aware in both frontend and PostgreSQL.

### E2E findings

- DB trigger successfully rejected an intentionally overlapping assignment across two studies owned by the same researcher.
- public busy-interval query returned owner-wide occupancy rather than study-local occupancy.
- schedule cancellation notification initially failed before provider delivery because `notifications_kind_check` allowed only `schedule_confirmation`; migration `allow_schedule_cancellation_notifications` fixed it.
- ClawMail testing reached a runtime `Daily send limit of 5 reached` condition. Application behavior correctly retained the schedule change and marked notification delivery failed rather than rolling back the assignment.

### Deployment state after the final application changes

The production control plane eventually recorded application code `dd5eab...` as a READY deployment on the persistent `research-align` Vercel project.

---

## 2026-08-16 KST — ClawMail contact and schedule notification path established

### Major changes

- ClawMail added as the current email provider.
- study-specific provider material stored in `private.clawmail_material`.
- researcher contact UI can provision a study mailbox, sync inbound mail, and send replies.
- public pre-application inquiry widget added to participant pages.
- inquiry threads can later match to participant applications using conservative email/name matching.
- schedule confirmation/change email introduced with notification auditing.
- automatic schedule emails written into the participant contact conversation with metadata identifying them as schedule notifications.

### Relevant historical commits

- `ee76e0503d4fa09a927edf8797cc5bd0c793dc7d` — public inquiry form
- `cb563c3f472ac0aeb7246ecd126abacebfe649f7` — inquiry/applicant matching
- `f99447165de5993bcd6ddf41fefa740414a80710` — matched inquiry integration in participant contact view
- `f62cdd4ace14a60a20c163a8a6f3f3941798a76f` — notification delivery tracking
- `ac50c338f525aaf2603a28eda79aaeeb06db42a1` — schedule confirmation email function
- `825c26716f4e299eb9b8f6712e8177de6414986f` — send and track schedule confirmation email
- `709a33c5f69b011878694055468e759dff5f7476` — preserve inquiry state during automatic schedule notifications

---

## 2026-08-15 to 2026-08-16 KST — Initial production architecture and deployment control plane

### Foundation

- Next.js + Supabase researcher/participant application established.
- multi-tenant researcher ownership and RLS added.
- form builder, participant application, response storage, schedule assignment, and contact workspace established.
- private KeyID experiments were performed early in development but ceased to be the current email path.

### Deployment architecture

A server-side Supabase deployment control plane was created so production deployment does not depend on Vercel GitHub App repository authorization.

Primary path became:

```text
GitHub source
  -> deploy_control_jobs
  -> pg_net trigger
  -> vercel-control Edge Function
  -> Vercel REST / Files Deployment
  -> deploy_control_state
```

The initial Vercel bootstrap token was rotated to a dedicated deploy-control token and recorded as revoked afterward.

GitHub Actions deployment remains a manual fallback.