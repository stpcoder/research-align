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
- Production commit: unchanged (`dd5eab06280f78f37d5926f4d940ef697c04d4b0`)

### Verification
- `[PASS]` GitHub `main` advanced to `2e475a880495575de41376a3fde786ae7f749abd` with this file added.

### Notes / follow-up
- Protocol documents are being updated immediately afterward to make this ledger mandatory for all future development work.
