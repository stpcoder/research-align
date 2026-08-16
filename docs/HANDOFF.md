# Research Align — Latest Session Handoff

Handoff prepared: **2026-08-16 23:09 KST**

This file is the operational checkpoint for the next conversation. Read root `AGENTS.md` first, then this file, `docs/PROJECT_STATE.md`, and `docs/SESSION_PROTOCOL.md`.

## 1. Session identity

- repository: `stpcoder/research-align`
- active branch: `main`
- work status: `clean`
- session topic: persistent cross-session development context and atomic commit/recovery protocol
- next session should continue branch: `main`
- no runtime feature is partially implemented
- no uncommitted code state is being intentionally carried across sessions

## 2. Exact source state

Current GitHub `main` immediately before this final handoff bookkeeping commit:

`babaa5dde98921299e79bff9fd1040cbb4ecb6b5`

Message:

`docs(dev): establish cross-session commit protocol`

The final commit containing this HANDOFF and the DEVELOPMENT_LOG update will be newer than `babaa5...`; the next session must query live `main` HEAD as required by `AGENTS.md`.

### Runtime/source distinction

- last runtime-affecting application commit: `dd5eab06280f78f37d5926f4d940ef697c04d4b0`
- deployed production commit: `dd5eab06280f78f37d5926f4d940ef697c04d4b0`
- current repository HEAD is ahead only because cross-session development documentation/protocol commits were added
- there is no unexplained runtime drift

### Commits created while establishing repository memory/protocol

1. `a2e71c277bd8f22f2d1e84f1f84cde2d2863bf51` — add persistent root `AGENTS.md`
2. `f39b17e4aaa42122981164bf420c63eacc61d5dd` — add durable `docs/PROJECT_STATE.md`
3. `086fd92c08f1efdcc0505a39ce592ccf3a83aeff` — add append-only `docs/DEVELOPMENT_LOG.md`
4. `079fe2d51eb2d91d603fa06a70dc5896b6e2d9cd` — add rolling `docs/HANDOFF.md`
5. `babaa5dde98921299e79bff9fd1040cbb4ecb6b5` — atomically strengthen `AGENTS.md` and add `docs/SESSION_PROTOCOL.md` + `docs/HANDOFF_TEMPLATE.md`
6. final handoff bookkeeping commit — contains this file plus the matching DEVELOPMENT_LOG entry; query live `main` to obtain its SHA

The important commit-discipline change is commit 5: the three files form one logical change and were intentionally committed as one Git tree/commit rather than arbitrary per-file commits.

## 3. In-progress work

### Current logical unit

None.

### Completed

The repository now contains a durable cross-session development system covering:

- mandatory startup reading order
- live-state baseline verification
- source/DB/Edge/Vercel/behavior state separation
- one-logical-change-per-commit discipline
- atomic multi-file commits
- conventional commit naming
- small direct-main vs large `work/YYYYMMDD-topic` branch policy
- DB migration rollout rules including expand/deploy/contract
- Edge Function auth/probe cleanup bookkeeping
- production deployment verification rules
- interrupted-session recovery algorithm
- mandatory final handoff + development-log commit
- reusable `docs/HANDOFF_TEMPLATE.md`

### Not complete

No product/runtime feature is intentionally left unfinished from this documentation session.

### Uncommitted/unsafe state

None known. GitHub is the durable state.

## 4. Production application state

Live `public.deploy_control_state` was queried again at the end of this session.

- Vercel project: `research-align`
- Vercel project ID: `prj_m1b582jShPhKBRfxY8GLDxAPFrGQ`
- production deployment ID: `dpl_AcPUSSgYSPxbhkVtK99BKACtTyQ5`
- status: `READY`
- production URL: `https://research-align.vercel.app`
- production commit: `dd5eab06280f78f37d5926f4d940ef697c04d4b0`
- deploy-control state updated: `2026-08-16 18:52:41 KST`

### Source/deployment drift

Expected and explained:

```text
GitHub main
  dd5eab... runtime code
  + documentation/protocol-only commits

Production runtime
  dd5eab...
```

No application deployment was triggered because this session did not change runtime behavior.

Do not create a new Vercel project if the top-level Vercel connector cannot list this one. Query Supabase `deploy_control_state` first.

## 5. Supabase state

- project: `rgwqsqeikebwunbdnbex`
- region: `ap-northeast-1`
- no database mutation was made in this session
- no migration was applied in this session
- latest previously verified important runtime migration remains `buffer_aware_schedule_conflicts`

### Migrations involved this session

None.

### Functions / triggers / RLS changed this session

None.

## 6. Edge Functions

No Edge Function was changed or deployed in this session.

### Temporary probes

No new temporary probe was created.

Previously known test/probe functions were already verified as disabled/JWT-protected HTTP 410 stubs where applicable in the prior architecture audit.

## 7. Repository-memory files now in use

### `AGENTS.md`

Durable contract. It now explicitly requires:

- one logical change per commit
- atomic multi-file feature commits
- prompt commit of completed checkpoints
- work branches for risky/multi-session changes
- conventional commit categories
- migration/source synchronization
- interrupted-session recovery
- final handoff commit

### `docs/SESSION_PROTOCOL.md`

Concrete step-by-step lifecycle:

```text
session start
→ live baseline
→ classify task
→ logical work-item loop
→ verify
→ atomic commit
→ DB/Edge rollout if relevant
→ production deploy if intended
→ production behavior verification
→ final handoff/log commit
```

It also explicitly models five separate completion states:

1. source committed
2. DB applied
3. Edge Function deployed
4. app deployed
5. behavior verified

### `docs/HANDOFF_TEMPLATE.md`

Required structure for every future session handoff, including exact SHA/deployment/migration/function/test/next-action fields.

### `docs/HANDOFF.md`

Rolling current state. Replace at each normal session end.

### `docs/DEVELOPMENT_LOG.md`

Append-only durable history. Newest entries go at the top.

### `docs/PROJECT_STATE.md`

Durable product/architecture state. Update only when actual product architecture changes.

## 8. Existing product/runtime state to preserve

The repository-memory work did not change these implemented behaviors.

### Multi-study scheduling

- researcher-wide conflict visibility
- DB owner-wide overlap enforcement
- owner-wide public busy intervals
- participant recheck before submission
- duration + `bufferMinutes` conflict handling
- session order and `maxSessionsPerDay`
- direct researcher-agreed scheduling
- 4-date schedule window

### Assignment lifecycle

- `confirmed`
- `completed`
- `no_show`
- `cancelled`
- cancellation preserves rows

### Form Builder

- range/7-day date addition
- location
- participant instructions
- buffer
- dirty-state warning

### Dashboard

- today
- unscheduled
- reply-needed
- mail failure
- per-study counts
- cross-study agenda

### Contact/email

- ClawMail is current transport
- Supabase contact tables are source of truth
- public inquiries and conservative applicant matching
- thread states pending/open/closed
- automatic schedule email does not clear pending inquiry
- confirmation/change/cancellation notification audit
- email provider failure does not roll back schedule state

### Removed/legacy behavior

- SMS is not a current product feature
- Google Calendar is removed; legacy functions are disabled stubs
- KeyID is legacy, not current transport

## 9. Critical source-maintenance warning

Current runtime still uses build-time rewriting:

`package.json` → `scripts/prebuild-ui-copy.mjs` → rewrites `src/app/page.tsx`

Current primary components:

- `src/components/ResearchHome.tsx`
- `src/components/FormBuilderUnified.tsx`
- `src/components/ResponseManagerUnified.tsx`
- `src/components/ScheduleUnified.tsx`
- `src/components/ContactManager.tsx`
- `src/components/ParticipantForm.tsx`

Do not edit or reason from `src/app/page.tsx` alone without checking the prebuild script.

## 10. Verification actually performed this session

### Repository verification

- `[PASS]` fetched existing `AGENTS.md` and `docs/HANDOFF.md`
- `[PASS]` fetched existing `docs/DEVELOPMENT_LOG.md`
- `[PASS]` confirmed pre-protocol `main` HEAD `079fe2d...`
- `[PASS]` created one atomic Git tree containing updated `AGENTS.md`, new `SESSION_PROTOCOL.md`, and new `HANDOFF_TEMPLATE.md`
- `[PASS]` created commit `babaa5dde98921299e79bff9fd1040cbb4ecb6b5`
- `[PASS]` fast-forwarded `main` to `babaa5...`
- `[PASS]` re-fetched `main` and confirmed it points to `babaa5...`

### Production/deploy verification

- `[PASS]` re-queried `public.deploy_control_state`
- `[PASS]` deployment remains `dpl_AcPUSSgYSPxbhkVtK99BKACtTyQ5`
- `[PASS]` status remains `READY`
- `[PASS]` production commit remains `dd5eab...`
- `[PASS]` production URL remains `https://research-align.vercel.app`

### Runtime/application verification

Not rerun because no runtime code, DB, or Edge Function changed in this session.

## 11. Bugs/findings from this session

### Previous documentation system was correct but insufficiently strict

Impact:

- it documented session startup/end but did not precisely define atomic multi-file commits, branch strategy, staged DB rollout, or crash recovery state reconstruction

Resolution:

- fixed by `babaa5dde98921299e79bff9fd1040cbb4ecb6b5`

## 12. Known unresolved risks/backlog

### P0 before real participant scale

- ClawMail sending capacity/quota. Prior E2E encountered `Daily send limit of 5 reached`.

### P1 maintainability/operations

- remove build-time `page.tsx` rewriting with behavior parity
- add CI and branch protection for `main`
- clean production demo/test data before real pilot
- clean stale KeyID/probe/README/SOURCE_MANIFEST state

### P2 security/performance

- review/revoke unnecessary anonymous `create_demo_study()` EXECUTE privilege
- review intentionally public SECURITY DEFINER grants
- consider leaked-password protection
- consider indexes for `contact_threads.response_id`, `notifications.response_id`, `studies.owner_id`

## 13. Exact next action

There is no incomplete implementation to recover first.

The next session should:

> Read `AGENTS.md`, follow `docs/SESSION_PROTOCOL.md`, verify live GitHub/Supabase/deployment baseline, then begin the user's next product-development request. Commit each completed logical change before starting the next independent change.

If the next requested feature is large or likely to span sessions, create `work/YYYYMMDD-<topic>` immediately and record it in the next HANDOFF.

## 14. Recovery instructions if this handoff is stale

1. query current GitHub `main` HEAD
2. inspect commits newer than `babaa5dde98921299e79bff9fd1040cbb4ecb6b5`
3. inspect any `work/*` branch named in a newer handoff
4. query Supabase migration history if runtime/DB work appeared
5. query relevant Edge Function versions
6. query `deploy_control_state`
7. reconstruct this table before writing code:

```text
change | source committed | DB applied | edge deployed | app deployed | behavior verified
```

## 15. Documentation state

- `AGENTS.md`: updated this session
- `docs/SESSION_PROTOCOL.md`: added this session
- `docs/HANDOFF_TEMPLATE.md`: added this session
- `docs/PROJECT_STATE.md`: unchanged; no durable runtime architecture change
- `docs/DEVELOPMENT_LOG.md`: final session entry updated with this handoff
- final handoff commit: this file's commit; next session should query live `main` HEAD to obtain the exact SHA

## 16. Suggested exact prompt for the next chat

> `stpcoder/research-align` 개발을 이어가자. 다른 대화의 기억을 가정하지 말고 GitHub `main`의 `AGENTS.md`부터 읽어서 거기에 적힌 startup protocol을 그대로 수행해. `docs/HANDOFF.md`, `docs/PROJECT_STATE.md`, `docs/SESSION_PROTOCOL.md`를 읽고, UI 작업이면 `docs/ADMIN_DESIGN_SYSTEM.md`도 읽어. 실제 GitHub branch/HEAD와 Supabase `deploy_control_state`를 다시 확인한 뒤 HANDOFF의 exact next action에서 이어가. 하나의 논리적 수정이 끝나고 검증될 때마다 atomic commit을 만들고 다음 독립 수정으로 넘어가. DB/Edge/Vercel 상태는 source commit과 별도로 추적하고, 세션 종료 전 HANDOFF를 교체하고 DEVELOPMENT_LOG를 append한 뒤 그것도 commit해.`
