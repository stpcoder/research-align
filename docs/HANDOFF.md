# Research Align — Latest Session Handoff

Handoff prepared: **2026-08-17 KST**

Read root `AGENTS.md` first, then this file, `docs/PROJECT_STATE.md`, `docs/WORKSPACE_PROTOCOL.md`, `docs/SESSION_PROTOCOL.md`, `docs/CHANGE_LEDGER.md`, and `docs/ADMIN_DESIGN_SYSTEM.md`.

## 1. Session identity

- repository: `stpcoder/research-align`
- active branch: `main`
- work status: clean
- session topic: visual consistency audit / residual CSS drift removal
- next session should continue branch: `main`
- no runtime feature is partially implemented
- no local-only product state remains

### Workspace hydration state

- preferred workspace path: `/mnt/data/research-align`
- workspace mode: `connector-only`
- trusted full local checkout: none
- local-only state remaining: none
- safe to lose current mount: yes
- local build environment available: no
- build verification came from the production Vercel deployment

## 2. Exact source and production state

GitHub `main` before the final DESIGN_SYSTEM + DEVELOPMENT_LOG + HANDOFF docs commit:

`7b91e4004e7a2e8886f759b9f30992175767b449`

Message:

`docs(ledger): record visual consistency rollout`

The final docs commit containing this handoff will be newer. A future session must query live `main` rather than assuming the SHA above is still HEAD.

### Latest meaningful source change

`3ae63c66fb5208e920b006b65cd02ab04c87f27e` — `refactor(ui): remove visual style drift`

Mapped ledger entry:

`CHANGE-20260817-018`

### Production

- production URL: `https://research-align.vercel.app`
- Vercel deployment: `dpl_6wjyszA3h7mhVrFpjRX99zFdfxtu`
- Vercel status: `READY`
- exact deployed repository snapshot: `1eef5a91aed7ee25c754502b22e3f89e8f3faa93`
- meaningful runtime source inside that snapshot: `3ae63c66fb5208e920b006b65cd02ab04c87f27e`
- snapshot source: `github-codeload`
- deploy-control job: `84b5bfd7-fd3b-476f-88d4-e756337833db`
- pg_net request: `126`
- job status: `succeeded`

GitHub `main` is ahead of production only by CHANGE-018 rollout bookkeeping and final documentation. There is no unexplained runtime drift.

## 3. What CHANGE-018 changed

This was a visual/cascade refactor only. No application behavior code, database schema, Edge Function, or provider contract changed.

### CSS ownership consolidation

`src/app/admin-foundation.css` is now the sole structural owner for generic authenticated researcher UI:

- font family/type scale
- 1px normal divider/border geometry
- major surface geometry
- button geometry/variants
- input/select/textarea geometry
- page/section/panel header structure
- list/status/data-row/table structure
- selected-state treatment

The following imported files are now page/domain layout/state layers rather than competing generic component systems:

- `admin-unified.css`
- `workspace.css`
- `ops-enhancements.css`
- `schedule-planner.css`
- `form-controls.css`
- `availability-editor.css`

`ui-polish.css` was removed from `layout.tsx` imports. The file may still exist in the repo but no longer affects runtime.

### Home

Study entries visually behave as rows in one shared parent surface separated by the standard 1px divider rather than one rounded bordered card per study.

### Schedule

- session selector is a divider-row list rather than nested rounded mini-cards
- session numbers are plain metadata rather than circular badges
- redundant current/grid/confirmation helper lines are visually suppressed
- coordination/change/blocking context uses horizontal separators instead of another rounded card
- meaningful cell/legend/current metadata is 12px
- explicit chosen-slot emphasis is limited to a 2px temporary outline
- confirmation bar targets the actual shared `.aui-button` implementation

### Contact / Form

- automatic schedule notification marker is quiet metadata rather than another pill
- redundant form date-count microcopy is not displayed

## 4. Current shared design-system contract

### React component owner

`src/components/admin/AdminUI.tsx`

Generic UI must reuse the shared primitives already documented in `docs/ADMIN_DESIGN_SYSTEM.md`. Do not create page-specific button/dropdown/input/table/metric/list-row lookalikes.

### CSS token/geometry owner

`src/app/admin-foundation.css`

Key invariants:

- `--ui-line-width = 1px`
- routine metadata/helper/status = 12px
- 11px only for genuine kicker/index roles
- normal major surface radius = 11px
- normal control radius = 8px
- input/select single-line minimum height = 38px
- button normal/small heights = 36px / 32px
- same font family across researcher pages

Page CSS may own layout and truly domain-specific state backgrounds. It must not use higher-specificity selectors to change generic input/button/select padding, font, height, border, or divider rules.

## 5. Source-level visual audit evidence

After CHANGE-018, GitHub code search returned no matches for:

- `font-size:10`
- `font-size:11`
- raw `className="btn` researcher controls

The important audit finding was that the remaining risk was mostly CSS cascade duplication rather than missing React primitives.

## 6. Backend / provider state

Unchanged during this audit:

- Supabase project: `rgwqsqeikebwunbdnbex`
- no DB migration
- no trigger/RPC/RLS change
- no Edge Function change
- ClawMail contract unchanged
- schedule-notify contract unchanged
- vercel-control remains live v4 with exact-SHA codeload deployment support

## 7. Verification boundary

Verified:

- source commit durable in GitHub
- CHANGE-018 mapped to exact source SHA
- `main` fast-forwarded without divergence
- deploy-control job succeeded
- request `126` returned Vercel READY
- production exact SHA matches `1eef5a91aed7ee25c754502b22e3f89e8f3faa93`
- production Next.js/TypeScript build accepted the CSS ownership consolidation
- `snapshotSource = github-codeload`

Not run:

- authenticated researcher screenshot audit
- authenticated Home → 신청서 → 신청자 → 일정 → 연락 click-through
- realistic long-name / long-email / long-session-label visual overflow test

Do not describe those browser checks as completed until an authenticated researcher browser context exists.

## 8. Ledger bookkeeping caveat

The initial CHANGE-018 ledger write reconstructed the full ledger through the GitHub connector and unintentionally normalized wording in several older entries (CHANGE-011, CHANGE-008, CHANGE-006). No source SHA, deployment state, or factual meaning changed. CHANGE-018 explicitly records this so the bookkeeping-only wording diff is not silent.

## 9. Remaining high-value work

### UX / visual

The shared-system/source audit is complete enough that further visual changes should be based on **actual authenticated screenshots**, not speculative polish.

When a researcher browser session is available, audit with realistic data:

- very long participant names
- long email addresses
- long study/session titles
- multiple sessions
- many dates
- pending/failed/confirmed states

Check specifically:

- text clipping/overflow
- button/dropdown/input heights
- horizontal and vertical 1px line alignment
- timetable/blackout grid line consistency
- selected-state visibility
- whether any low-value tiny text or nested box remains

Only fix concrete findings.

### Maintainability

If authenticated visual context remains unavailable, the next highest-value frontend task is to remove the remaining `scripts/prebuild-ui-copy.mjs` top-level `page.tsx` / StudyWorkspace source mutation while preserving all current behavior.

### Before real pilot

- resolve/validate ClawMail send capacity
- add CI build/lint gates and branch protection
- intentionally clean production demo/test data

## 10. Recovery instructions

If this handoff is stale:

1. query current GitHub `main`
2. read commits newer than `7b91e4004e7a2e8886f759b9f30992175767b449`
3. reconcile source commits with `docs/CHANGE_LEDGER.md`
4. inspect any recorded work branch before creating another one
5. query live `deploy_control_state`
6. expected production baseline from this session is `dpl_6wjyszA3h7mhVrFpjRX99zFdfxtu`, exact snapshot `1eef5a91...`, READY
7. distinguish docs-only HEAD movement from runtime drift

## 11. Suggested next-chat prompt

> Continue `stpcoder/research-align`. Read root `AGENTS.md` and the full startup protocol. Verify current GitHub main and live Supabase `deploy_control_state`, then continue from `docs/HANDOFF.md`. Preserve the admin design-system contract: generic components belong in `AdminUI.tsx`, generic font/line/control geometry belongs in `admin-foundation.css`, and page/domain CSS must not reimplement generic component styling. If an authenticated researcher browser context is available, perform the concrete visual audit described in HANDOFF; otherwise continue with the next high-value maintainability or product task and ledger every meaningful change separately.
