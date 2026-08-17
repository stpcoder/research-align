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
4. If the change later gets deployed, migrated, or further verified, update that entry with the resulting deployment/migration/verification state before session handoff.
5. Never silently delete old entries. Corrections should explain what was corrected.
6. Pure ledger/handoff bookkeeping commits are exempt from getting their own ledger entry; otherwise logging would recurse forever.
7. Tiny mechanical edits that are inseparable from one logical change belong inside that change's single entry, not separate entries for every line edit.
8. `docs/DEVELOPMENT_LOG.md` remains the session-level narrative. This file is the **per-change ledger**.

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

- Time: 2026-08-17 12:32 KST
- Type: docs
- Area: development-process
- Source commit: `pending-this-change`
- Branch: `main`
- Status: committed

### What changed
- Added this granular change ledger so future development records every meaningful logical modification individually rather than only summarizing at session end.
- Defined the one-logical-change/one-ledger-entry relationship and exempted bookkeeping-only ledger/handoff commits from recursive logging.

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
- Production commit: unchanged

### Verification
- `[PASS]` file committed to GitHub `main` and retrievable through the GitHub connector.

### Notes / follow-up
- The exact source SHA is discoverable as the commit that added this file. Future entries must use exact SHAs once known.
