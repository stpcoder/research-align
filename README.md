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
- KeyID integration is server-only: study-specific Ed25519 material is kept in an unexposed Supabase `private` schema; Next.js route handlers provision the research identity, send email, and ingest inbound email/SMS webhooks.
- Demo study seed with 4 synthetic participants, 30-minute training + 90-minute experiment availability, assignments, and a sample inquiry thread.

## Login / onboarding

Open the deployed root URL. Every researcher creates their own account with **새 연구자 가입** and then logs in with the same email/password. There is intentionally no shared global administrator account: each researcher is the administrator of their own tenant.

On first login, the current source auto-seeds one demo study once. The dashboard also keeps a **샘플 연구 만들기** button for an additional demo.

> Hosted Supabase projects may require email confirmation depending on Auth settings.

## Participant workflow

1. Researcher publishes a study.
2. Share `/s/<study-slug>`.
3. Participant fills custom fields and chooses available slots.
4. Participant optionally ranks Top-N preferred slots.
5. Response is stored, but no slot is reserved yet.
6. Researcher manually assigns a submitted slot in Schedule.
7. Researcher explicitly confirms the assignment.

## KeyID flow

`Contact Hub -> KeyID 연구용 주소 연결` calls:

- `POST /api/keyid/provision`
  - verifies Supabase researcher JWT
  - verifies Study ownership through RLS
  - creates/reuses durable KeyID seed + webhook token from `private.keyid_material`
  - provisions/authenticates KeyID
  - registers a webhook for email/SMS received events
  - stores the public research contact identity in `study_contact_channels`
- `POST /api/keyid/send`
  - accepts only an existing owned contact thread
  - ignores arbitrary browser-provided recipients and sends to the participant address already stored in that thread
  - writes the outbound message to `contact_messages`
- `POST /api/keyid/webhook`
  - public webhook endpoint with a high-entropy per-study token
  - only inserts rows when RLS validates the SHA-256 token hash against the active KeyID channel
  - stores inbound email/SMS in the same Contact Hub

The current JS-side integration sends email and accepts inbound email/SMS. If `get_identity()` exposes a persistent phone, it is displayed and stored. Explicit `request_phone()`/outbound SMS is intentionally not guessed from undocumented REST endpoints; add it when the current KeyID JS API exposes the method or endpoint you want to use.

## Environment

The checked-in config contains only the Supabase project URL and **publishable** key, which are safe for browser use. Do not add Supabase service-role keys or KeyID private seed values to `NEXT_PUBLIC_*` variables.

Optional environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

## Development

```bash
npm install
npm run dev
```

Production:

```bash
npm run build
npm start
```

## Database

The live Supabase project has already received the migrations in `supabase/migrations/`. `supabase/schema.sql` is an idempotent schema snapshot for orientation/recovery; use migrations for controlled changes.

## Security notes

- RLS is enabled on all exposed public tables.
- Public participants can read only published studies and insert responses to published studies.
- Researcher management access always resolves through `studies.owner_id = auth.uid()`.
- KeyID private material lives in the non-exposed `private` schema.
- The frontend never receives the KeyID private seed or webhook token.
- Webhook writes are limited by RLS and a per-study high-entropy token hash.
