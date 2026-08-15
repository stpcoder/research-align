# StudyForm

Human-subject research form, scheduling, and participant-contact workspace.

## What this build does

- Supabase email/password authentication for researchers.
- Multi-tenant isolation: one researcher can own many studies; RLS prevents access to another researcher's studies, responses, assignments, and contact threads.
- Google-Forms-like study builder with short/long/email/phone/radio/checkbox/instruction/availability fields.
- Availability fields support session duration, start interval, dates, operating hours, min/max selections, and Top-N preference ranking.
- Participant page at `/s/[slug]`: availability submission is a request, not an immediate reservation.
- Scheduling workspace with participant-selected slots, preference ranks, interval collision checks, session-order constraints, max-sessions-per-day constraint, draft assignment, and explicit confirmation.
- Contact Hub that uses only participant-submitted email/phone data.
- KeyID integration is server-only: study-specific Ed25519 material is kept in an unexposed Supabase `private` schema; Next.js route handlers provision the research identity, send email, request a persistent phone when available, and ingest inbound email/SMS webhooks.
- Demo study seed with 4 synthetic participants, 30-minute training + 90-minute experiment availability, assignments, and a sample inquiry thread.

## Login / onboarding

Open the deployed root URL. Every researcher creates their own account with **새 연구자 가입** and then logs in with the same email/password. There is intentionally no shared global administrator account for normal operation: each researcher is the administrator of their own tenant.

On first login, the current source auto-seeds one demo study once. The dashboard also keeps a **샘플 연구 만들기** button for an additional demo.

## Participant workflow

1. Researcher publishes a study.
2. Share `/s/<study-slug>`.
3. Participant fills custom fields and chooses available slots.
4. Participant optionally ranks Top-N preferred slots.
5. Response is stored, but no slot is reserved yet.
6. Researcher manually assigns a submitted slot in Schedule.
7. Researcher explicitly confirms the assignment.

## KeyID flow

`Contact Hub -> KeyID 연구용 주소 연결` calls the Next.js server only. The server verifies the researcher JWT and study ownership, reads/reuses the study-specific Ed25519 material from `private.keyid_material`, provisions/authenticates KeyID, requests the persistent phone when supported, registers the inbound webhook, and stores only the public research contact identity in `study_contact_channels`.

Outbound email only accepts an existing owned participant contact thread; arbitrary browser-supplied recipients are ignored. Inbound webhook inserts are gated by a high-entropy per-study token hash and RLS.

## Environment

The checked-in config contains only the Supabase project URL and **publishable** key, which are safe for browser use. Do not add Supabase service-role keys, KeyID project keys, private seeds, or webhook tokens to `NEXT_PUBLIC_*` variables.

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
# Optional server-only KeyID dedicated/private-pool project key
KEYID_PROJECT_KEY=
```

## Current KeyID production note (2026-08-15)

KeyID's public documentation describes `projectKey` as optional for dedicated pools, but direct server-side provisioning with the official `@keyid/sdk@0.4.3` currently returns `Project key required` from production for this deployment environment. The app therefore supports the optional server-only `KEYID_PROJECT_KEY`. Once a valid KeyID project key is configured in Vercel, `Contact Hub -> KeyID 연구용 주소 연결` reuses the study's durable Ed25519 seed, provisions the identity, requests the persistent phone number, and registers the inbound webhook.

## Development

```bash
npm install
npm run dev
```

## Database & security

The live Supabase project has already received the migrations in `supabase/migrations/`.

- RLS is enabled on exposed application tables.
- Public participants can read only published studies and insert responses to published studies.
- Researcher management access resolves through `studies.owner_id = auth.uid()`.
- KeyID private material lives in the non-exposed `private` schema.
- The frontend never receives the KeyID private seed or webhook token.

## Repository

Source of truth: `stpcoder/research-align` (`main`).
