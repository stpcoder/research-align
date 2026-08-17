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

## CHANGE-20260817-018 — Remove residual visual style drift and box/microcopy density

- Time: 2026-08-17 21:36 KST
- Type: refactor
- Area: admin-ui / visual-consistency / css
- Source commit: `3ae63c66fb5208e920b006b65cd02ab04c87f27e`
- Branch: `work/20260817-visual-consistency-audit`
- Status: committed

### What changed
- Consolidated structural researcher-UI CSS ownership so `admin-foundation.css` owns shared page headers, surfaces, controls, list rows, status badges, actions, rows, tables, typography, and 1px line geometry instead of relying on later cascade overrides over duplicate definitions.
- Reduced `admin-unified.css`, `workspace.css`, and `ops-enhancements.css` to current page/domain layout rules rather than competing generic component definitions.
- Removed the stale `ui-polish.css` runtime import so old Contact identity and sub-12px overrides no longer participate in the cascade.
- Research Home study entries now read as rows inside one shared surface separated by the standard 1px divider instead of one rounded bordered card per study.
- Schedule session selection now uses divider rows inside one surface instead of a grid of rounded mini-cards; session numbers are plain metadata rather than circular badges.
- Removed visually redundant Schedule helper lines where the selected participant/session, assignment state, grid title, or confirmation action already communicates the same state.
- Converted schedule coordination/change/blocking notices from nested rounded boxes into inline divider-separated context.
- Standardized Schedule legend/cell/current metadata to the 12px metadata scale and reduced explicit chosen-slot outline from 3px to 2px.
- Corrected confirmation-bar button styling to target the actual shared `.aui-button` component.
- Reduced automatic schedule-message labeling in Contact to quiet metadata instead of another pill and hid the redundant Form date-count microcopy.

### Files / objects
- `src/app/admin-foundation.css`
- `src/app/admin-unified.css`
- `src/app/workspace.css`
- `src/app/ops-enhancements.css`
- `src/app/schedule-planner.css`
- `src/app/layout.tsx`

### Database
- Migration: none
- Production applied: not-applicable
- Live verification: no database schema, trigger, RPC, or RLS behavior changed

### Edge / provider
- Function/provider: none
- Deployment/auth state: ClawMail and schedule-notify contracts unchanged

### Application deployment
- Deployment ID: not deployed yet
- Production commit: unchanged at `dfb8a7796b90bce663a8e48fcf90296cd1857ad0`

### Verification
- `[PASS]` atomic CSS/layout source commit created on the visual-consistency work branch without changing application behavior code.
- `[PASS]` audit confirmed the main residual problem was duplicate CSS ownership/high-specificity page overrides rather than missing shared React primitives.
- `[NOT RUN]` exact Vercel production build and authenticated researcher visual E2E; rollout verification follows this ledger checkpoint.

### Notes / follow-up
- `ui-polish.css` remains an unimported legacy file for now; it no longer affects runtime. It can be deleted later with other dead CSS after dependency review.
- `globals.css` remains the legacy/public baseline; authenticated researcher generic component ownership is `admin-foundation.css`.

---

## CHANGE-20260817-017 — Complete shared admin primitive migration across researcher pages

- Time: 2026-08-17 20:52 KST
- Type: refactor
- Area: admin-ui / design-system / home / form / schedule
- Source commit: `a1741845de378eeef85308e74298d34850acefb3`
- Branch: `work/20260817-admin-primitives-complete`
- Status: production-deployed

### What changed
- Completed the migration from page-local lookalike controls to shared React admin primitives across the remaining researcher Home, Form, and Schedule work areas.
- Expanded `AdminUI.tsx` with reusable link buttons, icon buttons, section headers, metric strips, menu items, and action rows so generic interactions no longer need page-specific button/list implementations.
- Centralized the admin font family and explicit 1px line-width token in `admin-foundation.css`; buttons, inputs, dropdowns, surfaces, rows, tables, horizontal dividers, vertical dividers, selected states, and specialized timetable grid lines now resolve to the same tokens.
- Migrated Research Home to shared page header, buttons, status badges, metric strip, section header, surface, text actions, link button, and agenda action rows. Per-study operational counters are now quiet text actions instead of four small box controls.
- Moved the `published -> 모집 중지 -> closed -> 삭제` lifecycle into canonical `ResearchHome.tsx` and removed the fragile build-time string patch for that behavior.
- Migrated Form Builder controls to shared fields, inputs, selects, textareas, buttons, icon buttons, and menu items; removed routine `저장됨`, field-number microcopy, repeated section explanations, date-pill boxes, boxed required-state copy, and redundant option descriptions.
- Moved the Form Builder publish-save callback into canonical `FormBuilderUnified.tsx`, so the prebuild script no longer mutates Form Builder source to inject it.
- Migrated Schedule search/filter controls, page/panel actions, date navigation, coordination actions, assignment actions, and confirmation actions to the same shared primitives. Domain-specific session selectors and timetable cells remain specialized because they encode scheduling state, but their typography and line system still come from shared tokens.
- Preserved scheduling, contact, form persistence, recruitment lifecycle, and notification behavior while reducing build-time UI source mutation to the remaining top-level StudyWorkspace/page compatibility layer and date-window safety patch.

### Files / objects
- `src/components/admin/AdminUI.tsx`
- `src/app/admin-foundation.css`
- `src/components/ResearchHome.tsx`
- `src/components/FormBuilderUnified.tsx`
- `src/components/ScheduleUnified.tsx`
- `src/app/form-controls.css`
- `scripts/prebuild-ui-copy.mjs`

### Database
- Migration: none
- Production applied: not-applicable
- Live verification: no database schema, trigger, RPC, or RLS behavior changed

### Edge / provider
- Function/provider: none
- Deployment/auth state: ClawMail and schedule-notify contracts unchanged

### Application deployment
- Deployment ID: `dpl_HcfM9jkpgDoSmXpfwDu4VCpgCrJv`
- Production commit: `dfb8a7796b90bce663a8e48fcf90296cd1857ad0`

### Verification
- `[PASS]` final source was squashed into one commit directly on parent `fdb0e31ae2c139abbc71e9b179628b140ebd7ba2`; intermediate work-branch checkpoint history is not part of the final branch history.
- `[PASS]` compare shows exactly one source commit and seven intended files changed from the prior production baseline.
- `[PASS]` generic controls now have a shared component owner; specialized schedule/blackout grid cells remain domain-specific by design while sharing font/line tokens.
- `[PASS]` deploy-control job `3e3d7508-73d9-4eb6-a2e2-cfe3557a9280` succeeded; request `125` produced READY Vercel deployment `dpl_HcfM9jkpgDoSmXpfwDu4VCpgCrJv`.
- `[PASS]` `deploy_control_state.status = READY`, `commitSha = dfb8a7796b90bce663a8e48fcf90296cd1857ad0`, and `snapshotSource = github-codeload`.
- `[PASS]` the production Next.js/TypeScript build accepted the shared Home/Form/Schedule primitive migration and reduced prebuild mutation.
- `[NOT RUN]` authenticated researcher visual/click E2E is unavailable in this connector-only session.

### Notes / follow-up
- Future generic admin controls should be added to `AdminUI.tsx` and tokenized in `admin-foundation.css`, not recreated per page. Domain-specific interaction surfaces may remain specialized when they encode unique behavior, but must consume the same typography, line, spacing, and semantic-state tokens.

---

## CHANGE-20260817-016 — Remove legacy visual conflicts and box/microcopy drift

- Time: 2026-08-17 21:00 KST
- Type: refactor
- Area: admin-ui / css / visual-system
- Source commit: `8c4a7872f24b73410f0650ba064cc7a1c90c27e3`
- Branch: `work/20260817-admin-design-system`
- Status: production-deployed

### What changed
- Extended the final-loaded admin foundation so Home, Form, Schedule, Contact, and participant-management surfaces resolve to the same shared border, divider, typography, selection, control, and grid-line tokens even where legacy class names remain.
- Converted Home's four separate metric cards into one shared surface split by the standard 1px divider system.
- Removed decorative duplicate `FORM` / `SCHEDULE` kickers and nonessential Form panel helper copy from the rendered design without adding replacement labels.
- Normalized routine form/schedule/availability helper, legend, and cell text to the 12px metadata scale instead of page-specific 10–11px values.
- Changed Form choice editing from one bordered rounded box per option to plain divider rows; removed dashed bordered empty-state boxes.
- Standardized availability/blackout grid borders, input suffix borders, control heights, and legend typography to the foundation tokens.
- Added explicit compatibility overrides preventing old schedule selected/next-action left-rail styles from reappearing.
- Deleted unused legacy `src/app/admin-system.css` and `src/app/admin-ux.css`, which were not imported and duplicated/conflicted with the current admin design language.

### Files / objects
- `src/app/admin-foundation.css`
- `src/app/form-controls.css`
- `src/app/availability-editor.css`
- deleted `src/app/admin-system.css`
- deleted `src/app/admin-ux.css`

### Database
- Migration: none
- Production applied: not-applicable
- Live verification: no database behavior changed

### Edge / provider
- Function/provider: none
- Deployment/auth state: none

### Application deployment
- Deployment ID: `dpl_ArkQh4QUyjMG1ehnrR99WrAcVnhG`
- Production commit: `fdb0e31ae2c139abbc71e9b179628b140ebd7ba2`

### Verification
- `[PASS]` cleanup was committed atomically after CHANGE-015 was ledgered.
- `[PASS]` specialized timetable/blackout controls retain task-specific layout/state colors while their line thickness, font scale, and base geometry resolve to the same shared tokens.
- `[PASS]` deploy-control job `6dc462a6-cc4a-41af-8b6e-aa499d047fa2` / request `124` built the combined design-system branch as READY deployment `dpl_ArkQh4QUyjMG1ehnrR99WrAcVnhG`.
- `[PASS]` exact production SHA for that rollout was `fdb0e31ae2c139abbc71e9b179628b140ebd7ba2`; the current later production also contains this change.
- `[NOT RUN]` authenticated researcher visual E2E was unavailable.

### Notes / follow-up
- Domain-specific schedule cells and message bubbles remain specialized components by design; generic buttons, controls, lists, rows, surfaces, and typography are governed by the shared foundation.

---

## CHANGE-20260817-015 — Migrate Contact workspace to shared admin primitives

- Time: 2026-08-17 20:50 KST
- Type: refactor
- Area: contact / admin-ui
- Source commit: `6a80a9f08e3aa97fcbf0f97c17dc782b0317c212`
- Branch: `work/20260817-admin-design-system`
- Status: production-deployed

### What changed
- Replaced Contact's page-specific header, card/list controls, search input, navigation buttons, composer inputs, and schedule rows with the same shared `AdminPageHeader`, `AdminSurface`, `AdminSplitView`, `AdminListItem`, `AdminButton`, `AdminInput`, `AdminTextarea`, `AdminField`, `AdminActions`, `AdminDivider`, and `AdminDataRow` primitives used by other researcher work areas.
- Inquiry and participant sidebars now use the same selected-row treatment, typography hierarchy, status badges, and line system as the applicant page instead of custom `.person` boxes.
- The research-mailbox utility moved into the shared page-header action region, eliminating a separate page-specific status/header component.
- Inline participant schedule context now uses shared data rows rather than a custom row implementation.
- Kept domain-specific email message bubbles and all ClawMail/thread/participant/schedule behavior unchanged.

### Files / objects
- `src/components/ContactManager.tsx`

### Database
- Migration: none
- Production applied: not-applicable
- Live verification: contact/scheduling queries unchanged

### Edge / provider
- Function/provider: ClawMail display/client wiring only
- Deployment/auth state: provider contract unchanged

### Application deployment
- Deployment ID: `dpl_ArkQh4QUyjMG1ehnrR99WrAcVnhG`
- Production commit: `fdb0e31ae2c139abbc71e9b179628b140ebd7ba2`

### Verification
- `[PASS]` source commit created after CHANGE-014 was ledgered, preserving the one-change-at-a-time sequence.
- `[PASS]` Contact consumes the shared primitives rather than duplicating equivalent list/control/row components.
- `[PASS]` the combined admin design-system branch reached READY as `dpl_ArkQh4QUyjMG1ehnrR99WrAcVnhG` through job `6dc462a6-cc4a-41af-8b6e-aa499d047fa2`; this source commit is an ancestor of deployed SHA `fdb0e31...`.
- `[NOT RUN]` authenticated researcher Contact visual/click E2E was unavailable.

### Notes / follow-up
- The current later production continues to include this migration; generic Contact controls should continue using the shared admin primitives.

---

## CHANGE-20260817-014 — Migrate participant page to shared admin primitives

- Time: 2026-08-17 20:40 KST
- Type: refactor
- Area: participant / admin-ui
- Source commit: `8c2c6578b3175a9a170677768f647d639c6d7acf`
- Branch: `work/20260817-admin-design-system`
- Status: production-deployed

### What changed
- Replaced the participant-page search control and all participant-page action buttons with shared `AdminInput`, `AdminButton`, and `AdminActions` primitives.
- Removed the decorative `PARTICIPANTS` kicker and the internal response-ID microtext from the selected participant header.
- Shortened page and empty-state copy so the page relies on labels and hierarchy instead of repeated helper text.
- Replaced per-slot availability chips with shared row-based session summaries, reducing the number of small bordered elements.
- Replaced page-specific schedule/contact history rows with shared `AdminDataList` / `AdminDataRow` primitives while retaining semantic `StatusBadge` state.
- Kept all participant data/export/navigation behavior unchanged.

### Files / objects
- `src/components/ResponseManagerUnified.tsx`

### Database
- Migration: none
- Production applied: not-applicable
- Live verification: read/write behavior unchanged

### Edge / provider
- Function/provider: none
- Deployment/auth state: none

### Application deployment
- Deployment ID: `dpl_ArkQh4QUyjMG1ehnrR99WrAcVnhG`
- Production commit: `fdb0e31ae2c139abbc71e9b179628b140ebd7ba2`

### Verification
- `[PASS]` source commit created on the design-system work branch after CHANGE-013 was ledgered.
- `[PASS]` the migration uses only shared primitives introduced in CHANGE-013 and removes page-local decorative elements without changing queries or state transitions.
- `[PASS]` the combined admin design-system branch reached READY as `dpl_ArkQh4QUyjMG1ehnrR99WrAcVnhG` through job `6dc462a6-cc4a-41af-8b6e-aa499d047fa2`; this source commit is an ancestor of deployed SHA `fdb0e31...`.
- `[NOT RUN]` authenticated participant-admin visual E2E was unavailable.

### Notes / follow-up
- The current later production continues to include this migration.

---

## CHANGE-20260817-013 — Establish one shared admin design foundation

- Time: 2026-08-17 20:27 KST
- Type: refactor
- Area: admin-ui / design-system
- Source commit: `6c35064df79111d37fc1f3c48abd24f06ed6f3be`
- Branch: `work/20260817-admin-design-system`
- Status: production-deployed

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
- Deployment ID: `dpl_ArkQh4QUyjMG1ehnrR99WrAcVnhG`
- Production commit: `fdb0e31ae2c139abbc71e9b179628b140ebd7ba2`

### Verification
- `[PASS]` atomic foundation source commit created on `work/20260817-admin-design-system` from baseline `1244212fd33630bbf971fe6f3bb21961d82c6b72`.
- `[PASS]` compatibility layer preserves existing class names while centralizing shared geometry.
- `[PASS]` the combined admin design-system branch reached READY as `dpl_ArkQh4QUyjMG1ehnrR99WrAcVnhG` through job `6dc462a6-cc4a-41af-8b6e-aa499d047fa2`; this source commit is an ancestor of deployed SHA `fdb0e31...`.
- `[NOT RUN]` authenticated researcher visual E2E was unavailable.

### Notes / follow-up
- This foundation is now further extended by CHANGE-017; new generic researcher UI must add/reuse shared primitives rather than creating page-local equivalents.

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
- Contact now loads current-study assignments with participants and contact threads.
- the selected matched participant's conversation shows one inline `일정` section
- every configured session is one compact row: session name, current assignment time or submitted availability preview, semantic status
- unassigned availability is ordered by preference rank
- at most three candidate slots are displayed; additional slots collapse to `+N`
- the detailed timetable remains in Schedule via `일정 보기`
- the context is separated with normal horizontal dividers inside the existing conversation surface; no nested card or colored side rail was added

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
- Contact keeps the same participant and provides `일정 보기` and `신청 내용` actions.
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
- Added deterministic exact-SHA snapshot download through `codeload.github.com` when deploy manifest contains `commitSha`.
- Exact-SHA codeload deployments avoid the low unauthenticated GitHub REST API rate limit on shared Supabase egress IPs while preserving deterministic source selection.
- Existing GitHub REST snapshot behavior remains available when no explicit commit SHA is supplied.
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
- If form validation or persistence fails and dirty state remains, publishing is aborted instead of exposing stale saved data.
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