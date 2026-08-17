# Research Align — Latest Session Handoff

Handoff prepared: **2026-08-17 KST**

Read root `AGENTS.md` first, then this file, `docs/PROJECT_STATE.md`, `docs/WORKSPACE_PROTOCOL.md`, `docs/SESSION_PROTOCOL.md`, `docs/CHANGE_LEDGER.md`, and `docs/ADMIN_DESIGN_SYSTEM.md`.

## 1. Session identity

- repository: `stpcoder/research-align`
- active branch: `main`
- work status: `clean`
- session topic: shared admin primitive/design-system completion
- next session should continue branch: `main`
- no runtime feature is partially implemented
- no local-only product code is being carried forward

### Workspace hydration state

- preferred workspace path: `/mnt/data/research-align`
- workspace mode: `connector-only`
- trusted full local checkout: none
- local-only state remaining: none
- safe to lose current mount: yes
- local build environment available: no
- production build validation came from Vercel deployment

## 2. Exact source state

GitHub `main` immediately before the final ADMIN_DESIGN_SYSTEM + PROJECT_STATE + DEVELOPMENT_LOG + HANDOFF documentation commit:

`6abd945bb1e9ce81e3d5f0c3eeae72bb9a82ec5a`

Message:

`docs(ledger): reconcile admin design rollout`

The final documentation commit containing this handoff will be newer than `6abd945...`; the next session must query live `main` HEAD.

### Production/source distinction

Production currently runs exact repository snapshot:

`dfb8a7796b90bce663a8e48fcf90296cd1857ad0`

The meaningful runtime source commit inside that snapshot is:

`a1741845de378eeef85308e74298d34850acefb3` — `refactor(ui): complete shared admin primitive migration`

`dfb8a779...` adds the initial CHANGE-017 ledger bookkeeping on top of that runtime source and was the exact SHA deployed.

GitHub `main` is ahead of production only by ledger/documentation bookkeeping:

- `9551beffae97dec4bd17a7d220a70becca6608cb` — attach CHANGE-017 rollout result
- `6abd945bb1e9ce81e3d5f0c3eeae72bb9a82ec5a` — reconcile CHANGE-013 through CHANGE-016 rollout state
- final documentation commit — ADMIN_DESIGN_SYSTEM + PROJECT_STATE + DEVELOPMENT_LOG + this HANDOFF

There is **no unexplained runtime drift**.

### Meaningful source commits covered by this design-system effort

Earlier phase, already integrated/deployed:

1. `6c35064df79111d37fc1f3c48abd24f06ed6f3be` — shared admin foundation
2. `8c2c6578b3175a9a170677768f647d639c6d7acf` — participant-page shared primitive migration
3. `6a80a9f08e3aa97fcbf0f97c17dc782b0317c212` — Contact shared primitive migration
4. `8c4a7872f24b73410f0650ba064cc7a1c90c27e3` — legacy visual conflict/microcopy cleanup

Final completion:

5. `a1741845de378eeef85308e74298d34850acefb3` — Home/Form/Schedule shared primitive migration and canonicalization cleanup

### Granular ledger mapping

| Change ID | Source commit | Latest state |
|---|---|---|
| `CHANGE-20260817-013` | `6c35064df79111d37fc1f3c48abd24f06ed6f3be` | production-deployed |
| `CHANGE-20260817-014` | `8c2c6578b3175a9a170677768f647d639c6d7acf` | production-deployed |
| `CHANGE-20260817-015` | `6a80a9f08e3aa97fcbf0f97c17dc782b0317c212` | production-deployed |
| `CHANGE-20260817-016` | `8c4a7872f24b73410f0650ba064cc7a1c90c27e3` | production-deployed |
| `CHANGE-20260817-017` | `a1741845de378eeef85308e74298d34850acefb3` | production-deployed |

The earlier CHANGE-013..016 entries were reconciled in `6abd945...` because their source had already been successfully deployed in the `fdb0e31...` production snapshot but their status field still said `committed`.

## 3. Shared admin design system — current source of truth

### Generic component owner

`src/components/admin/AdminUI.tsx`

Generic researcher UI must reuse shared primitives. Current primitives include:

- `AdminButton`
- `AdminLinkButton`
- `AdminIconButton`
- `AdminInput`
- `AdminSelect`
- `AdminTextarea`
- `AdminField`
- `AdminActions`
- `AdminToolbar`
- `AdminPageHeader`
- `AdminSectionHeader`
- `AdminPanelHeader`
- `AdminSurface`
- `AdminSplitView`
- `AdminDivider`
- `StatusBadge`
- `AdminListItem`
- `AdminMenuItem`
- `AdminActionRow`
- `AdminDataList`
- `AdminDataRow`
- `AdminMetricStrip`
- `AdminMetric`
- `AdminTable`
- `AdminTableRow`
- `AdminTableCell`
- `SegmentedControl`

Do not create page-specific copies of these interaction patterns.

### Token/geometry owner

`src/app/admin-foundation.css`

This owns:

- `--ui-font-family`
- `--ui-line-width = 1px`
- normal/strong line colors
- horizontal/vertical divider geometry
- page/section/panel/body/label/meta type scale
- surface border/radius/padding
- button variants and geometry
- input/select/textarea geometry
- list/data-row/table geometry
- selected full-surface treatment
- compatibility aliases for legacy class names
- shared schedule/blackout/timetable grid-line base tokens

Routine metadata/helper/status text is 12px. 11px is reserved for true kicker/index use. Routine 10px helper text should not be introduced.

### Generic vs specialized boundary

Specialized UI is allowed only when the interaction is genuinely domain-specific.

Current intentionally specialized examples:

- schedule session selector
- schedule timetable cell
- availability blackout cell
- email message bubble

Those specialized surfaces still use the shared font, line, spacing, radius and semantic-state tokens. “Specialized” does not allow a second button/input/table system.

## 4. Page implementation state

### Home

- page header/actions use shared primitives
- top metrics use one `AdminMetricStrip` with shared dividers, not four cards
- study status/buttons use shared primitives
- per-study operational counts are quiet text actions rather than small boxes
- upcoming agenda uses `AdminActionRow`
- stop-before-delete lifecycle is canonical in `ResearchHome.tsx`

### 신청서

- generic input/select/textarea/button/icon/menu controls use shared primitives
- choice rows use divider-row structure instead of box-per-choice
- redundant always-visible `저장됨`, question-number microcopy, repeated settings explanations, boxed required-state copy and date-pill boxes were removed/reduced
- blackout grid remains specialized
- publish-save callback is canonical in `FormBuilderUnified.tsx`

### 신청자

- participant list, search, actions and history/data rows use shared primitives
- per-slot chip boxes/internal ID microtext were removed in the prior phase

### 일정

- search/filter, navigation arrows, page/panel actions, assignment actions, coordination actions and confirmation buttons use shared primitives
- participant list shares the same list language as 신청자/연락
- session selector and timetable cells remain specialized scheduling controls
- timetable consumes the shared 1px line/type system

### 연락

- page header, mailbox actions, search, participant/inquiry list, conversation actions, composer controls and inline schedule rows use shared primitives
- email message bubbles remain specialized

## 5. Build-time source mutation state

`npm run dev/build` still runs `scripts/prebuild-ui-copy.mjs`.

The mutation surface is smaller now:

- ResearchHome stop-before-delete behavior is **canonical source**, no longer prebuild-patched
- FormBuilder publish-save callback is **canonical source**, no longer prebuild-patched
- remaining prebuild work is the legacy top-level `page.tsx` / StudyWorkspace compatibility transformation plus date-window safety replacement

Removing that remaining mutation is still a high-value maintainability task, but it should preserve all current runtime behavior.

## 6. Production application state

Latest successful rollout:

- Vercel project ID: `prj_m1b582jShPhKBRfxY8GLDxAPFrGQ`
- deployment ID: `dpl_HcfM9jkpgDoSmXpfwDu4VCpgCrJv`
- status: `READY`
- production URL: `https://research-align.vercel.app`
- production repository snapshot: `dfb8a7796b90bce663a8e48fcf90296cd1857ad0`
- meaningful runtime source inside snapshot: `a1741845de378eeef85308e74298d34850acefb3`
- snapshot source: `github-codeload`
- deploy-control job: `3e3d7508-73d9-4eb6-a2e2-cfe3557a9280`
- pg_net request: `125`
- job status: `succeeded`

Previous design-system phase rollout:

- deployment: `dpl_ArkQh4QUyjMG1ehnrR99WrAcVnhG`
- exact SHA: `fdb0e31ae2c139abbc71e9b179628b140ebd7ba2`
- job: `6dc462a6-cc4a-41af-8b6e-aa499d047fa2`
- request: `124`
- READY

## 7. Supabase / Edge state

- project: `rgwqsqeikebwunbdnbex`
- no database migration was required for this design-system work
- no PostgreSQL function/trigger/RLS change was made
- no Edge Function was changed
- ClawMail contract unchanged
- schedule-notify contract unchanged
- vercel-control remains live v4 with exact-SHA codeload support
- no temporary probes created

## 8. Verification actually performed

### Source / repository

- `[PASS]` CHANGE-013 through CHANGE-016 source commits are durable and ledgered
- `[PASS]` CHANGE-017 final source commit `a1741845...` was squashed directly on prior production parent `fdb0e31...`
- `[PASS]` intermediate Home-only WIP checkpoint was removed from the final work-branch history and is not a ledgered logical change
- `[PASS]` final CHANGE-017 source diff contained exactly seven intended runtime/source files
- `[PASS]` CHANGE-013 through CHANGE-017 ledger rollout states reconciled

### Build / deployment

- `[PASS]` earlier combined design-system deployment `dpl_Ark...` READY on exact SHA `fdb0e31...`
- `[PASS]` final deploy-control job `3e3d7508-73d9-4eb6-a2e2-cfe3557a9280` succeeded
- `[PASS]` request `125` returned Vercel READY
- `[PASS]` deployment `dpl_HcfM9jkpgDoSmXpfwDu4VCpgCrJv` READY
- `[PASS]` production `commitSha = dfb8a7796b90bce663a8e48fcf90296cd1857ad0`
- `[PASS]` `snapshotSource = github-codeload`
- `[PASS]` production Next.js/TypeScript build accepted the shared component migration

### Browser / interaction boundary

- `[NOT RUN]` authenticated researcher visual audit
- `[NOT RUN]` authenticated Home → Form → Applicant → Schedule → Contact click-through
- `[NOT RUN]` visual verification with intentionally long names/emails/session labels

Do not describe these as E2E-tested until an authenticated researcher browser context is available.

## 9. Durable design constraints for future work

- generic controls must be shared React primitives, not page-specific lookalikes
- shared font family/type/line/radius/control geometry belongs in `admin-foundation.css`
- page CSS may control layout and domain-specific state backgrounds, not generic geometry
- normal horizontal/vertical/grid lines are 1px and share the same token system
- routine metadata is 12px; remove information that is too minor to deserve that role
- avoid card-per-value/card-inside-card patterns
- avoid left-edge-only selection/status patterns
- prefer rows, dividers, whitespace and typography over more rectangles
- update the design system first if a reusable pattern is missing

## 10. Known unresolved risks / backlog

### P0 before real pilot

- ClawMail sending capacity/quota still requires validation or upgrade

### P1 UX

- run authenticated visual/click audit across Home → 신청서 → 신청자 → 일정 → 연락
- include realistic long names/emails/session labels and multi-session studies
- verify text overflow, control heights, horizontal/vertical divider alignment, timetable line thickness, selected-state consistency and absence of accidental tiny text/box regressions
- fix only concrete findings; do not add another decorative UI layer

### P1 maintainability / operations

- remove remaining top-level `scripts/prebuild-ui-copy.mjs` mutation and make StudyWorkspace/page behavior canonical
- add CI build/lint checks and branch protection
- clean production demo/test data intentionally
- clean legacy/probe/stale docs after dependency review

### P2

- persisted schedule proposals/acceptance only if real negotiation workflow demonstrates the need
- Supabase advisor hardening/index recommendations

## 11. Exact next action

Preferred next action:

> Obtain an authenticated researcher browser context and perform a visual/click audit of the entire current workflow using realistic data. Specifically check shared button/dropdown/input heights, font scale, 1px horizontal/vertical dividers, schedule/blackout grid lines, long-value overflow, selected rows, and whether any page still introduces unnecessary small text or nested boxes. Record only concrete findings as new logical changes.

If authenticated browser context remains unavailable, the next product/operational task can proceed; the design-system migration is already production-build verified.

## 12. Recovery instructions if this handoff is stale

1. query current GitHub `main`
2. inspect commits newer than pre-final HEAD `6abd945bb1e9ce81e3d5f0c3eeae72bb9a82ec5a`
3. compare meaningful source commits against `docs/CHANGE_LEDGER.md`
4. inspect any recorded work branch before creating another one
5. query `deploy_control_state`
6. expected production baseline from this session is deployment `dpl_HcfM9jkpgDoSmXpfwDu4VCpgCrJv`, snapshot `dfb8a779...`, READY
7. distinguish docs-only HEAD movement from runtime drift before editing

## 13. Session documentation status

- CHANGE_LEDGER reconciled with meaningful source commits: yes
- CHANGE-017 rollout state attached: yes
- CHANGE-013 through CHANGE-016 stale rollout states reconciled: yes
- ADMIN_DESIGN_SYSTEM prepared for final update: yes
- PROJECT_STATE prepared for final update: yes
- DEVELOPMENT_LOG prepared for prepend: yes
- workspace local-only state: none
- safe to lose current mount: yes
- final handoff commit: query live main after this file is committed

## 14. Suggested next-chat prompt

> Continue `stpcoder/research-align`. Read root `AGENTS.md` and the full startup protocol, especially `docs/HANDOFF.md`, `docs/PROJECT_STATE.md`, `docs/ADMIN_DESIGN_SYSTEM.md`, `docs/WORKSPACE_PROTOCOL.md`, `docs/SESSION_PROTOCOL.md`, and `docs/CHANGE_LEDGER.md`. Verify current GitHub main and live Supabase `deploy_control_state`. Preserve the shared admin primitive rule: generic buttons/inputs/dropdowns/rows/tables/metrics must use `AdminUI.tsx`, and font/line/radius/control geometry must come from `admin-foundation.css`. Continue from HANDOFF's exact next action and ledger each meaningful change separately.
