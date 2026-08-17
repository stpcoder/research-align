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

## CHANGE-20260817-013 — Establish one shared admin design foundation

- Time: 2026-08-17 20:27 KST
- Type: refactor
- Area: admin-ui / design-system
- Source commit: `6c35064df79111d37fc1f3c48abd24f06ed6f3be`
- Branch: `work/20260817-admin-design-system`
- Status: committed

### What changed
- Added `src/app/admin-foundation.css` as the final-loaded source of truth for researcher/admin design tokens: typography scale, 1px divider/border system, surface radius/padding, control geometry, button variants, selected-row treatment, and shared table/data-row geometry.
- Added compatibility aliases so existing `.btn`, `.card`, `.aui-*`, `--line`, and `--soft` usages resolve to the same design tokens while pages are migrated instead of visually diverging during the refactor.
- Expanded `src/components/admin/AdminUI.tsx` with shared `AdminButton`, input/select/textarea, field, actions/toolbar, divider, data-row, and table primitives while preserving the existing page header/surface/list/status APIs.
- Imported the foundation stylesheet last from `src/app/layout.tsx`, making shared line thickness, font sizes, control dimensions, and border/radius rules authoritative over older page-local CSS.
- Rewrote `docs/ADMIN_DESIGN_SYSTEM.md` to make component/token reuse mandatory and explicitly prohibit page-local button/control geometry, routine sub-12px metadata, nested card accumulation, and left-edge-only state styling.

### Files / objects
- `src/app/admin-foundation.css`
- `src/components/admin/AdminUI.tsx`
- `src/app/layout.tsx`
- `docs/ADMIN_DESIGN_SYSTEM.md`

### Database
- Migration: none
- Production applied: not-applicable
- Live verification: no database behavior changed

### Edge / provider
- Function/provider: none
- Deployment/auth state: none

### Application deployment
- Deployment ID: not deployed; work branch only
- Production commit: unchanged at `a077cb8f0164df9a979cf6f7347e10b0917978dc`

### Verification
- `[PASS]` atomic foundation source commit created on `work/20260817-admin-design-system` from current main baseline `1244212fd33630bbf971fe6f3bb21961d82c6b72`.
- `[PASS]` compatibility layer intentionally preserves existing class names while centralizing their shared geometry.
- `[NOT RUN]` local Next.js build is unavailable in connector-only mode; production remains unchanged while page migration continues on the work branch.

### Notes / follow-up
- The next checkpoint migrates existing researcher pages toward these primitives and removes page-specific microcopy/box/border overrides before the work branch is integrated into `main`.

---

## CHANGE-20260817-012 — Simplify Contact chrome and remove redundant operational copy

- Time: 2026-08-17 19:05 KST
- Type: feat
- Area: contact / UX / visual hierarchy
- Source commit: `283065e65869da26b174470dc76edd8563a20aeb`
- Branch: `main`
- Status: production-deployed

### What changed
- Replaced the multi-line mailbox status box (`connected/missing` label + address/explanation + status dot) with a compact utility row showing only the research mailbox address, last sync time when useful, and one mailbox action.
- Removed duplicated inquiry state wording such as a `대기` pill plus separate `답변 필요/응대 중` text; pending state is now represented once as `답변 필요`.
- Removed redundant participant `새 문의` metadata when the same pending state is already visible as a badge.
- Shortened source and navigation labels (`신청자 문의`, `신청 전 문의`, `일정 보기`) and reduced verbose empty-state copy.
- Removed provider-return status text from successful sends and the duplicate recipient email from the composer footer.
- Preserved the compact schedule context from CHANGE-011 without adding cards, colored side rails, or left-edge-only state decoration.

### Files / objects
- `src/components/ContactManager.tsx`
- `src/app/ops-enhancements.css`

### Database
- Migration: none
- Production applied: not-applicable
- Live verification: no schema change

### Edge / provider
- Function/provider: ClawMail display only
- Deployment/auth state: provider/API contract unchanged

### Application deployment
- Deployment ID: `dpl_ACQXqHwb12F6K2mfp4ucAcczamT6`
- Production commit: `a077cb8f0164df9a979cf6f7347e10b0917978dc`

### Verification
- `[PASS]` source commit created atomically with copy reduction and compact mailbox/composer styling.
- `[PASS]` implementation follows `ADMIN_DESIGN_SYSTEM.md`: hierarchy before decoration, no nested contact card, no left-edge-only state indicator, and one clear primary composer action.
- `[PASS]` deploy-control job `0abc2c43-a852-47ea-aaf0-057014db2653` succeeded; pg_net request `123` returned a READY Vercel deployment.
- `[PASS]` production Next.js/TypeScript build accepted exact SHA `a077cb8f0164df9a979cf6f7347e10b0917978dc` via `github-codeload`.
- `[NOT RUN]` authenticated researcher Contact click/visual E2E was unavailable in this connector-only session.

### Notes / follow-up
- This change intentionally removes information rather than adding new interaction states; technical provider state remains available in the underlying data/functions, not repeated in primary UI.

---

## CHANGE-20260817-011 — Show compact participant schedule context inside Contact

- Time: 2026-08-17 19:03 KST
- Type: feat
- Area: contact / schedule / participant-workflow
- Source commit: `86e321f56db888a30dca57ec4b69bcee345eb07a`
- Branch: `main`
- Status: production-deployed

### What changed
- Contact now loads current study assignments together with participants and message threads.
- When a matched participant is selected, the conversation surface shows a compact `일정` section directly below the participant header.
- Each availability/session field is represented by one plain row: session name, current confirmed/completed/no-show time or a compact preview of submitted candidate slots, and a semantic status badge.
- Unscheduled candidate previews are ordered by submitted preference rank, show at most three concrete slots, and collapse remaining choices to `+N` to avoid visual overload.
- The context uses horizontal dividers inside the existing conversation surface rather than adding another card, colored side rail, or ornamental container.

### Files / objects
- `src/components/ContactManager.tsx`
- `src/app/ops-enhancements.css`

### Database
- Migration: none
- Production applied: not-applicable
- Live verification: no schema change; existing assignments data is read only

### Edge / provider
- Function/provider: none
- Deployment/auth state: ClawMail and schedule-notify contracts unchanged

### Application deployment
- Deployment ID: `dpl_ACQXqHwb12F6K2mfp4ucAcczamT6`
- Production commit: `a077cb8f0164df9a979cf6f7347e10b0917978dc`

### Verification
- `[PASS]` source commit created atomically with Contact logic and restrained schedule-context styling.
- `[PASS]` deploy-control job `0abc2c43-a852-47ea-aaf0-057014db2653` succeeded and Vercel reached READY.
- `[PASS]` production build includes this source commit as an ancestor of deployed SHA `a077cb8f0164df9a979cf6f7347e10b0917978dc`.
- `[NOT RUN]` authenticated researcher Contact click/visual E2E was unavailable in this connector-only session.

### Notes / follow-up
- The schedule context deliberately does not reproduce the full timetable; `일정 보기` remains the route for detailed coordination.

---

## CHANGE-20260817-010 — Turn manual scheduling into an explicit participant coordination flow

- Time: 2026-08-17 18:47 KST
- Type: feat
- Area: schedule / contact / coordination
- Source commit: `70af27d5fb1feafc748749ecf630c17116027f82`
- Branch: `main`
- Status: production-deployed

### What changed
- Replaced the implementation-oriented `직접 협의한 시간 지정` entry point with researcher-facing `다른 시간 조율하기`.
- Opening coordination no longer immediately enables every empty slot. The researcher must choose either `이메일로 시간 협의` or `이미 합의한 시간이 있음`.
- `이메일로 시간 협의` moves to the Contact view while preserving the same participant context.
- `이미 합의한 시간이 있음` explicitly enters the empty-slot selection mode for a time already agreed with the participant.
- Reworded `직접 협의` labels to `별도 합의` / `합의한 시간`, matching the actual researcher task instead of the implementation source field name.
- Coordination, change, and agreed-time modes are mutually exclusive and reset together on participant/session transitions and after confirmation/cancellation.
- The underlying `scheduling_source = admin_agreed` audit field remains unchanged.

### Files / objects
- `src/components/ScheduleUnified.tsx`

### Database
- Migration: none
- Production applied: not-applicable
- Live verification: existing `scheduling_source` and `agreement_confirmed_at` model retained

### Edge / provider
- Function/provider: none
- Deployment/auth state: schedule-notify and ClawMail contracts unchanged

### Application deployment
- Deployment ID: `dpl_G74DQabUEgvmCQsxXezPdbuhs7ef`
- Production commit: `a68c2439c66ecd663466a746adb37f085f5c57c0`

### Verification
- `[PASS]` source commit created on `main` with the new coordination decision flow.
- `[PASS]` exact-SHA Vercel production build completed READY; deploy-control job `f89494c6-a62b-4d73-bc31-48fbb36da4bd` succeeded.
- `[PASS]` `deploy_control_state` records `commitSha = a68c2439c66ecd663466a746adb37f085f5c57c0` and `snapshotSource = github-codeload`.
- `[NOT RUN]` authenticated researcher browser click-flow was unavailable in this connector-only session.

### Notes / follow-up
- This is intentionally not a proposed-time state machine yet; a future P2 can add explicit schedule proposals and participant acceptance tracking.

---

## CHANGE-20260817-009 — Clarify schedule change and post-session action hierarchy

- Time: 2026-08-17 18:43 KST
- Type: feat
- Area: schedule / safety / action hierarchy
- Source commit: `f78ff1c4a1a6bfb9830be11f5086d8037cd59b79`
- Branch: `main`
- Status: production-deployed

### What changed
- Added an explicit `시간 변경` mode for already-confirmed assignments. Researchers can no longer accidentally replace a confirmed time simply by clicking another grid cell.
- The existing assignment remains intact until a replacement slot is selected and the researcher explicitly confirms the change.
- Confirmation CTAs now describe the email side effect: `일정 확정하고 안내 보내기` and `일정 변경하고 안내 보내기`.
- `완료 처리` and `불참 처리` are shown only after the scheduled session end time, instead of competing with normal future-schedule actions.
- `일정 취소` now uses destructive button semantics.
- A failed notification retry becomes the primary recovery action, while normal unsent mail remains secondary.
- The timetable explains when change mode is required and shows a dedicated change-mode notice.

### Files / objects
- `src/components/ScheduleUnified.tsx`

### Database
- Migration: none
- Production applied: not-applicable
- Live verification: no scheduling invariant/schema change; existing assignment upsert and DB overlap trigger remain unchanged

### Edge / provider
- Function/provider: none
- Deployment/auth state: schedule-notify contract unchanged

### Application deployment
- Deployment ID: `dpl_G74DQabUEgvmCQsxXezPdbuhs7ef`
- Production commit: `a68c2439c66ecd663466a746adb37f085f5c57c0`

### Verification
- `[PASS]` source commit created on `main` with explicit change mode and time-aware post-session actions.
- `[PASS]` exact-SHA Vercel production build completed READY with this source as an ancestor of deployed commit `a68c2439...`.
- `[NOT RUN]` authenticated researcher browser click-flow was unavailable in this connector-only session.

### Notes / follow-up
- This change deliberately does not add a new assignment status; it clarifies interaction around the existing confirmed/completed/no_show/cancelled lifecycle.

---

## CHANGE-20260817-008 — Preserve participant context across applicant, schedule, and contact tabs

- Time: 2026-08-17 18:39 KST
- Type: feat
- Area: participant-workflow / navigation
- Source commit: `c9f20ca7d63fc1e734e597119113fdfdd93f2ac2`
- Branch: `main`
- Status: production-deployed

### What changed
- Added a shared researcher navigation helper that stores the active participant response ID in `?participant=` and dispatches an internal StudyWorkspace navigation event.
- Applicant, schedule, and contact views now restore the participant from the URL before falling back to their default selection.
- Selecting a participant in any of those views updates the shared participant context.
- Applicant detail now provides `일정 조율하기` and `연락하기` actions.
- Schedule keeps the same participant and provides a direct `이 참가자에게 연락` action.
- Contact keeps the same participant and provides `일정에서 보기` and `신청 내용` actions.
- Unmatched inquiry selection clears participant context so an unrelated applicant is not silently carried forward.

### Files / objects
- `src/lib/researcherNavigation.ts`
- `src/components/ResponseManagerUnified.tsx`
- `src/components/ScheduleUnified.tsx`
- `src/components/ContactManager.tsx`
- `scripts/prebuild-ui-copy.mjs`

### Database
- Migration: none
- Production applied: not-applicable
- Live verification: no schema change

### Edge / provider
- Function/provider: none
- Deployment/auth state: none

### Application deployment
- Deployment ID: `dpl_G74DQabUEgvmCQsxXezPdbuhs7ef`
- Production commit: `a68c2439c66ecd663466a746adb37f085f5c57c0`

### Verification
- `[PASS]` atomic source commit created on `main` for shared participant context and cross-tab CTAs.
- `[PASS]` exact-SHA Vercel production build completed READY with the build-time StudyWorkspace navigation event patch applied.
- `[NOT RUN]` authenticated researcher cross-tab click-flow was unavailable in this connector-only session.

### Notes / follow-up
- Participant context is intentionally URL-backed so normal top-tab switching and page reloads can restore the same participant without adding a new database concept.

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
- Exposed the mounted unified Form Builder's existing `save()` operation to the workspace while mounted.
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
- Added rules for dependency/cache non-persistence, secret handling, build-time `scripts/prebuild-ui-copy.mjs` mutations, interrupted-session recovery, and end-of-session `safe_to_lose_current_mount` reconciliation.
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
- Extended the handoff template so every session maps source commits to Change IDs and records DB/Edge/deployment/verification by Change ID.

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