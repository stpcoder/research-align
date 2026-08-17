# Research Align — Latest Session Handoff

Handoff prepared: **2026-08-17 18:52 KST**

Read root `AGENTS.md` first, then this file, `docs/PROJECT_STATE.md`, `docs/WORKSPACE_PROTOCOL.md`, `docs/SESSION_PROTOCOL.md`, and `docs/CHANGE_LEDGER.md`.

## 1. Session identity

- repository: `stpcoder/research-align`
- active branch: `main`
- work status: `clean`
- session topic: participant-centered researcher coordination UX P0
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

`6c21935c9e28994ff4699ec3807f77e3a58c852e`

Message:

`docs(ledger): record researcher UX rollout`

The final documentation commit containing this handoff will be newer than `6c21935...`; the next session must query live `main` HEAD.

### Production/source distinction

Production currently runs exact source snapshot:

`a68c2439c66ecd663466a746adb37f085f5c57c0`

That deployed commit contains all three researcher UX source changes plus their initial per-change ledger entries.

GitHub `main` is ahead only by documentation/bookkeeping after production:

- `6c21935c9e28994ff4699ec3807f77e3a58c852e` — update CHANGE-008/009/010 with production rollout result
- final documentation commit — PROJECT_STATE + DEVELOPMENT_LOG + this HANDOFF

There is **no unexplained runtime drift**.

### Meaningful source commits created this session

1. `c9f20ca7d63fc1e734e597119113fdfdd93f2ac2` — `feat(ops): preserve participant context across tabs`
2. `f78ff1c4a1a6bfb9830be11f5086d8037cd59b79` — `feat(schedule): clarify schedule action hierarchy`
3. `70af27d5fb1feafc748749ecf630c17116027f82` — `feat(schedule): add participant time coordination flow`

### Ledger bookkeeping sequence

- `73c5d8c8426547968f8e63f5d05955ad96c2d005` — record CHANGE-008
- `7dee86fbc8bd4e7d848838c1c6cf0e04e3ea233f` — record CHANGE-009
- `a68c2439c66ecd663466a746adb37f085f5c57c0` — record CHANGE-010; this exact commit was production-deployed
- `6c21935c9e28994ff4699ec3807f77e3a58c852e` — attach final rollout results to CHANGE-008/009/010

### Granular change ledger mapping

| Change ID | Source commit | Latest state |
|---|---|---|
| `CHANGE-20260817-008` | `c9f20ca7d63fc1e734e597119113fdfdd93f2ac2` | production-deployed |
| `CHANGE-20260817-009` | `f78ff1c4a1a6bfb9830be11f5086d8037cd59b79` | production-deployed |
| `CHANGE-20260817-010` | `70af27d5fb1feafc748749ecf630c17116027f82` | production-deployed |

Every meaningful source commit from this session has exactly one corresponding ledger entry.

## 3. User-facing behavior now deployed

### A. Participant context persists across work areas

Researcher participant context is URL-backed:

`?participant=<response_id>`

Applicant, Schedule, and Contact prefer that participant when they mount.

Cross-workflow actions now exist:

- 신청자 → `일정 조율하기`
- 신청자 → `연락하기`
- 일정 → `이 참가자에게 연락`
- 연락 → `일정에서 보기`
- 연락 → `신청 내용`

Selecting an unmatched public inquiry clears the participant query context.

`src/lib/researcherNavigation.ts` owns the small navigation helper. The top-level StudyWorkspace listener is currently injected by `scripts/prebuild-ui-copy.mjs`.

### B. Schedule actions are explicit and safer

For a new participant-provided slot:

`시간 선택 -> 일정 확정하고 안내 보내기`

For an already-confirmed assignment:

`시간 변경 -> 새 시간 선택 -> 일정 변경하고 안내 보내기`

A researcher cannot replace an existing confirmed assignment merely by clicking a different grid cell while not in change/agreed-time mode.

For future confirmed sessions:

- `완료 처리` and `불참 처리` are hidden
- `시간 변경` remains available
- `일정 취소` is destructive
- failed mail retry becomes the primary recovery action

After the session end time:

- `완료 처리`
- `불참 처리`

become available.

### C. Time coordination is task-oriented

The old `직접 협의한 시간 지정` entry point is replaced by:

`다른 시간 조율하기`

It branches into:

1. `이메일로 시간 협의`
   - opens Contact for the same participant
   - no assignment is modified
2. `이미 합의한 시간이 있음`
   - enables explicit agreed-time slot selection
   - uses existing `scheduling_source = admin_agreed`
   - confirmation label is `합의한 시간 확정하고 안내 보내기`

UI copy says `별도 합의` / `합의한 시간`; database audit vocabulary remains unchanged.

## 4. Production application state

Latest live `public.deploy_control_state`:

- Vercel project ID: `prj_m1b582jShPhKBRfxY8GLDxAPFrGQ`
- deployment ID: `dpl_G74DQabUEgvmCQsxXezPdbuhs7ef`
- status: `READY`
- production URL: `https://research-align.vercel.app`
- production commit: `a68c2439c66ecd663466a746adb37f085f5c57c0`
- snapshot source: `github-codeload`
- state updated: `2026-08-17 18:46:38 KST`

Deploy-control job:

- job ID: `f89494c6-a62b-4d73-bc31-48fbb36da4bd`
- pg_net request: `122`
- status: `succeeded`
- deployment: `dpl_G74DQabUEgvmCQsxXezPdbuhs7ef`
- Vercel state: `READY`

## 5. Supabase state

- project: `rgwqsqeikebwunbdnbex`
- no schema migration was required this session
- no PostgreSQL function/trigger/RLS change was made
- existing owner-wide scheduling constraints remain the enforcement layer
- existing `scheduling_source = participant_selection | admin_agreed` model is unchanged

### Migrations involved this session

None.

### Functions / triggers / RLS changed

None.

## 6. Edge Functions

No Edge Function was changed in this session.

Relevant existing state:

- `schedule-notify` contract unchanged
- `clawmail` contract unchanged
- `vercel-control` remains live v4 with exact-SHA codeload deployment support

### Temporary probes

None created.

## 7. Files/areas changed

### CHANGE-20260817-008

- `src/lib/researcherNavigation.ts`
- `src/components/ResponseManagerUnified.tsx`
- `src/components/ScheduleUnified.tsx`
- `src/components/ContactManager.tsx`
- `scripts/prebuild-ui-copy.mjs`

### CHANGE-20260817-009

- `src/components/ScheduleUnified.tsx`

### CHANGE-20260817-010

- `src/components/ScheduleUnified.tsx`

No database or provider source was changed.

## 8. Verification actually performed

### Source / repository

- `[PASS] CHANGE-008` atomic source commit created and fast-forwarded to main
- `[PASS] CHANGE-008` granular ledger entry committed before starting CHANGE-009
- `[PASS] CHANGE-009` source commit created and ledgered before CHANGE-010
- `[PASS] CHANGE-010` source commit created and ledgered before production rollout
- `[PASS]` all three meaningful source commits are ancestors of deployed SHA `a68c2439...`

### Build / deployment

- `[PASS]` deploy-control job `f89494c6-a62b-4d73-bc31-48fbb36da4bd` succeeded
- `[PASS]` Vercel deployment `dpl_G74DQabUEgvmCQsxXezPdbuhs7ef` reached READY
- `[PASS]` `deploy_control_state.details.commitSha = a68c2439c66ecd663466a746adb37f085f5c57c0`
- `[PASS]` `snapshotSource = github-codeload`
- `[PASS]` production Next.js/TypeScript build therefore accepted the new source and build-time workspace patch

### Browser / interaction boundary

- `[NOT RUN]` authenticated researcher cross-tab click flow
- `[NOT RUN]` authenticated `시간 변경` interaction
- `[NOT RUN]` authenticated `다른 시간 조율하기 -> 이메일/이미 합의` click flow
- `[NOT RUN]` independent curl smoke test because the sandbox DNS could not resolve the production hostname
- Vercel connector URL fetch also could not create a shareable/access URL for the canonical production domain

Do not describe those authenticated click flows as E2E-tested until a researcher-authenticated browser context is available.

## 9. Bugs/findings discovered this session

No new database or production build regression was found.

UX finding carried forward:

- Contact now preserves participant context and can jump back to Schedule, but the conversation itself still does not show that participant's current assignments and submitted availability.
- That means a researcher composing a negotiation email may still need to switch mentally between Contact and Schedule even though navigation is now one click.

## 10. Durable product state affected by this session

The application has moved from tab-local participant selection toward participant-centered research operations.

Current intended researcher mental model:

```text
participant selected
  -> inspect application
  -> schedule
  -> contact same participant if coordination needed
  -> return to same participant schedule
  -> confirm/change
  -> later complete/no-show
```

This is documented in `docs/PROJECT_STATE.md`.

## 11. Known unresolved risks / backlog

### P0 before real pilot

- ClawMail sending capacity/quota still requires validation or upgrade.

### P1 UX

- show selected participant's current schedule + submitted availability directly inside Contact
- once an authenticated researcher browser context is available, smoke-test the newly deployed cross-tab/change/coordination flows

### P1 operational / maintainability

- remove build-time `scripts/prebuild-ui-copy.mjs` mutation and make current StudyWorkspace/Unified behavior canonical source
- add CI build/lint checks and branch protection
- clean production demo/test data intentionally
- clean legacy/probe/stale documentation after dependency review

### P2

- consider persisted schedule proposals and participant acceptance (`proposed -> confirmed`) if negotiation should be tracked as first-class state
- review Supabase advisor hardening/index recommendations

## 12. Exact next action

Primary next UX action:

> Add a compact scheduling context to the selected participant's Contact conversation: current session assignments, unresolved session(s), and participant-submitted availability, with `일정에서 보기` as the direct action. Keep the same `?participant=` context and record it as the next independent CHANGE_LEDGER item.

If an authenticated researcher browser context becomes available before that implementation, first run a short smoke test of CHANGE-008/009/010 and record the results in their existing ledger entries.

## 13. Recovery instructions if this handoff is stale

1. query current GitHub `main`
2. inspect commits newer than the pre-final HEAD `6c21935c9e28994ff4699ec3807f77e3a58c852e`
3. compare meaningful source commits against `docs/CHANGE_LEDGER.md`
4. inspect any recorded work branch before creating a new one
5. query `deploy_control_state`
6. production expected baseline from this session is deployment `dpl_G74DQabUEgvmCQsxXezPdbuhs7ef`, commit `a68c2439...`, READY
7. reconstruct source/ledger/DB/Edge/deployment/verification state before editing if live state differs

## 14. Session documentation status

- CHANGE_LEDGER reconciled with all meaningful source commits: yes
- Change IDs created: `CHANGE-20260817-008`, `CHANGE-20260817-009`, `CHANGE-20260817-010`
- rollout status attached to those entries: yes
- PROJECT_STATE prepared for update: yes
- DEVELOPMENT_LOG prepared for append: yes
- workspace local-only state: none
- safe to lose current mount: yes
- final handoff commit: query live main after this file is committed

## 15. Suggested next-chat prompt

> Continue `stpcoder/research-align`. Read root `AGENTS.md` and follow the full startup/workspace protocol. Read `docs/HANDOFF.md`, `docs/PROJECT_STATE.md`, `docs/WORKSPACE_PROTOCOL.md`, `docs/SESSION_PROTOCOL.md`, and `docs/CHANGE_LEDGER.md`. Verify current GitHub main and live Supabase `deploy_control_state`. Continue from HANDOFF's exact next action. Preserve `?participant=` participant context and keep one logical source commit + one granular ledger entry per meaningful change. Finish with production verification and a new handoff.
