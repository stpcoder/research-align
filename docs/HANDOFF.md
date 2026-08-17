# Research Align — Latest Session Handoff

Handoff prepared: **2026-08-17 19:10 KST**

Read root `AGENTS.md` first, then this file, `docs/PROJECT_STATE.md`, `docs/WORKSPACE_PROTOCOL.md`, `docs/SESSION_PROTOCOL.md`, and `docs/CHANGE_LEDGER.md`.

## 1. Session identity

- repository: `stpcoder/research-align`
- active branch: `main`
- work status: `clean`
- session topic: Contact schedule context + restrained messaging UX simplification
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

GitHub `main` immediately before the final PROJECT_STATE + DEVELOPMENT_LOG + HANDOFF bookkeeping commit:

`faf1bcc89b4f7dc6e8f08200d084bee79e411942`

Message:

`docs(ledger): record contact UX rollout`

The final documentation commit containing this handoff will be newer than `faf1bcc...`; the next session must query live `main` HEAD.

### Production/source distinction

Production currently runs exact source snapshot:

`a077cb8f0164df9a979cf6f7347e10b0917978dc`

That deployed commit contains both Contact UX source changes and their initial ledger entries.

GitHub `main` is ahead only by documentation/bookkeeping after production:

- `faf1bcc89b4f7dc6e8f08200d084bee79e411942` — attach final production rollout results to CHANGE-011/012
- final documentation commit — PROJECT_STATE + DEVELOPMENT_LOG + this HANDOFF

There is **no unexplained runtime drift**.

### Meaningful source commits created this session

1. `86e321f56db888a30dca57ec4b69bcee345eb07a` — `feat(contact): show compact schedule context`
2. `283065e65869da26b174470dc76edd8563a20aeb` — `feat(contact): simplify messaging chrome`

### Ledger bookkeeping sequence

- `cba066fe677b0f11ec7b3dc55be65425d8071fec` — record CHANGE-011
- `a077cb8f0164df9a979cf6f7347e10b0917978dc` — record CHANGE-012; this exact commit was production-deployed
- `faf1bcc89b4f7dc6e8f08200d084bee79e411942` — attach final production rollout results to CHANGE-011/012

### Granular change ledger mapping

| Change ID | Source commit | Latest state |
|---|---|---|
| `CHANGE-20260817-011` | `86e321f56db888a30dca57ec4b69bcee345eb07a` | production-deployed |
| `CHANGE-20260817-012` | `283065e65869da26b174470dc76edd8563a20aeb` | production-deployed |

Every meaningful source commit from this session has exactly one corresponding ledger entry.

## 3. User-facing behavior now deployed

### A. Contact shows compact scheduling context

When a matched participant is selected, the existing conversation surface now includes a small `일정` section below the participant header.

For each configured availability/session field, one row shows:

- session name
- current assignment time if assigned, otherwise a preview of the participant's submitted availability
- status badge (`확정`, `완료`, `불참`, or `미정`)

Unassigned candidate times are preference-ranked, limited to three explicit slots, and additional candidates collapse to `+N`.

The full timetable is intentionally **not** duplicated in Contact. `일정 보기` remains the path for detailed scheduling/conflict work.

The schedule context is separated with normal horizontal dividers inside the current conversation surface. No additional nested card or colored side rail was introduced.

### B. Contact chrome/copy is reduced

The previous mailbox status box/status-dot stack was simplified.

Connected state shows only:

- research mailbox address
- last-sync time when available
- `새 메일 확인`

Disconnected state shows only:

- `연구용 이메일 연결`

Repeated operational copy was removed:

- pending state is represented once as `답변 필요`
- `대기`, `새 문의`, `응대 중` are not redundantly repeated around the same row
- recipient email is not repeated in the composer footer
- provider-return status text is not surfaced on successful send
- empty/source/navigation labels are shorter (`대기 문의 없음`, `신청자 문의`, `신청 전 문의`, `일정 보기`)

The composer still has one primary action: `이메일 보내기`.

## 4. Production application state

Latest live `public.deploy_control_state`:

- Vercel project ID: `prj_m1b582jShPhKBRfxY8GLDxAPFrGQ`
- deployment ID: `dpl_ACQXqHwb12F6K2mfp4ucAcczamT6`
- status: `READY`
- production URL: `https://research-align.vercel.app`
- production commit: `a077cb8f0164df9a979cf6f7347e10b0917978dc`
- snapshot source: `github-codeload`
- state updated: `2026-08-17 19:07:32 KST`

Deploy-control job:

- job ID: `0abc2c43-a852-47ea-aaf0-057014db2653`
- pg_net request: `123`
- status: `succeeded`
- deployment: `dpl_ACQXqHwb12F6K2mfp4ucAcczamT6`
- Vercel state: `READY`

## 5. Supabase state

- project: `rgwqsqeikebwunbdnbex`
- no schema migration was required this session
- no PostgreSQL function/trigger/RLS change was made
- Contact only reads existing assignment state for the new inline context
- scheduling write/invariant behavior remains unchanged

### Migrations involved this session

None.

### Functions / triggers / RLS changed

None.

## 6. Edge Functions / provider state

No Edge Function was changed in this session.

Relevant existing state:

- `clawmail` contract unchanged
- `schedule-notify` contract unchanged
- `vercel-control` remains live v4 with exact-SHA codeload support

Successful send UI no longer repeats provider-return status text, but underlying provider behavior/audit state is unchanged.

### Temporary probes

None created.

## 7. Files/areas changed

### CHANGE-20260817-011

- `src/components/ContactManager.tsx`
- `src/app/ops-enhancements.css`

### CHANGE-20260817-012

- `src/components/ContactManager.tsx`
- `src/app/ops-enhancements.css`

No database, Edge Function, or provider source changed.

## 8. Verification actually performed

### Source / repository

- `[PASS] CHANGE-011` atomic source commit created and ledgered before CHANGE-012
- `[PASS] CHANGE-012` atomic source commit created and ledgered before production rollout
- `[PASS]` both source commits are ancestors of deployed SHA `a077cb8f...`
- `[PASS]` CHANGE-011/012 rollout state was attached to their existing ledger entries

### Build / deployment

- `[PASS]` deploy-control job `0abc2c43-a852-47ea-aaf0-057014db2653` succeeded
- `[PASS]` pg_net request `123` returned HTTP 200 with Vercel READY
- `[PASS]` deployment `dpl_ACQXqHwb12F6K2mfp4ucAcczamT6` reached READY
- `[PASS]` `deploy_control_state.details.commitSha = a077cb8f0164df9a979cf6f7347e10b0917978dc`
- `[PASS]` `snapshotSource = github-codeload`
- `[PASS]` production Next.js/TypeScript build accepted Contact assignment-loading, schedule-preview logic, and the simplified chrome

### Browser / interaction boundary

- `[NOT RUN]` authenticated researcher visual inspection of the Contact screen
- `[NOT RUN]` authenticated Contact → Schedule click flow
- `[NOT RUN]` actual mailbox send/sync operation as part of this UX session

Do not describe these interaction flows as E2E-tested until a researcher-authenticated browser context is available.

## 9. Durable design constraint for future UI work

For researcher/admin screens, especially Contact/Schedule:

- do not increase card count merely to display one more piece of context
- remove explanatory text when labels/state already communicate the same fact
- avoid multiple synonymous state labels in one row
- avoid provider/implementation vocabulary in primary user-facing copy
- avoid a colored left border/left rail as the sole active/state treatment
- prefer typography, whitespace, subtle full-surface selection, dividers, and semantic badges
- keep one clear primary action per operational region

This is an explicit product/design constraint, not just a one-session styling preference.

## 10. Known unresolved risks / backlog

### P0 before real pilot

- ClawMail sending capacity/quota still requires validation or upgrade.

### P1 UX

- run an authenticated visual/click audit of the participant-centered Applicant → Schedule → Contact flow when a researcher browser session is available
- after that audit, fix only concrete confusion/overflow/state problems; do not add another coordination layer without a demonstrated workflow need

### P1 operational / maintainability

- remove build-time `scripts/prebuild-ui-copy.mjs` mutation and make current StudyWorkspace/Unified behavior canonical source
- add CI build/lint checks and branch protection
- clean production demo/test data intentionally
- clean legacy/probe/stale documentation after dependency review

### P2

- consider persisted schedule proposals and participant acceptance (`proposed -> confirmed`) only if negotiation needs first-class tracked state
- review Supabase advisor hardening/index recommendations

## 11. Exact next action

Preferred next UX action:

> Do an authenticated visual/click audit before adding more Contact/Schedule features. Verify that the compact schedule rows are readable with real participant data, long email/name/session values do not cause overflow, and Applicant → Schedule → Contact keeps the same participant. If concrete issues appear, fix those as individual CHANGE_LEDGER items. Otherwise stop adding UX complexity and move to the next product/operational priority.

If authenticated browser context is unavailable, the user's next requested development task can proceed; CHANGE-011/012 are already production-deployed and build-verified.

## 12. Recovery instructions if this handoff is stale

1. query current GitHub `main`
2. inspect commits newer than pre-final HEAD `faf1bcc89b4f7dc6e8f08200d084bee79e411942`
3. compare meaningful source commits against `docs/CHANGE_LEDGER.md`
4. inspect any recorded work branch before creating a new one
5. query `deploy_control_state`
6. expected production baseline from this session is deployment `dpl_ACQXqHwb12F6K2mfp4ucAcczamT6`, commit `a077cb8f...`, READY
7. reconstruct source/ledger/DB/Edge/deployment/verification state before editing if live state differs

## 13. Session documentation status

- CHANGE_LEDGER reconciled with all meaningful source commits: yes
- Change IDs created: `CHANGE-20260817-011`, `CHANGE-20260817-012`
- rollout status attached to both entries: yes
- PROJECT_STATE prepared for update: yes
- DEVELOPMENT_LOG prepared for append: yes
- workspace local-only state: none
- safe to lose current mount: yes
- final handoff commit: query live main after this file is committed

## 14. Suggested next-chat prompt

> Continue `stpcoder/research-align`. Read root `AGENTS.md` and follow the full startup/workspace protocol. Read `docs/HANDOFF.md`, `docs/PROJECT_STATE.md`, `docs/WORKSPACE_PROTOCOL.md`, `docs/SESSION_PROTOCOL.md`, `docs/CHANGE_LEDGER.md`, and `docs/ADMIN_DESIGN_SYSTEM.md`. Verify current GitHub main and live Supabase `deploy_control_state`. Preserve the participant-centered workflow and the current restrained UI rule: no unnecessary cards, duplicate explanatory copy, or left-edge-only state highlighting. Continue from HANDOFF's exact next action, commit and ledger each meaningful change separately, and finish with production verification plus a new handoff.
