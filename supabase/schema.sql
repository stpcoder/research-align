-- StudyForm schema snapshot (2026-08-15)
-- Orientation/recovery snapshot. Apply chronological files in supabase/migrations for controlled updates.

create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.studies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  slug text not null unique,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft','published','closed')),
  form_config jsonb not null default '{"fields":[]}'::jsonb,
  scheduling_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  participant_data jsonb not null default '{}'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  availability jsonb not null default '{}'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  contact_email text,
  contact_phone text,
  submitted_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  response_id uuid not null references public.responses(id) on delete cascade,
  session_key text not null,
  session_label text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','confirmed','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(response_id, session_key)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  response_id uuid not null references public.responses(id) on delete cascade,
  assignment_id uuid references public.assignments(id) on delete cascade,
  channel text not null check (channel in ('email','sms')),
  destination text not null,
  status text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.researcher_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  organization text,
  demo_seeded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_contact_channels (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  provider text not null default 'manual' check (provider in ('manual','keyid')),
  channel text not null check (channel in ('email','sms','phone')),
  address text,
  provider_identity_id text,
  status text not null default 'inactive' check (status in ('inactive','active','error')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_threads (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  response_id uuid references public.responses(id) on delete cascade,
  channel text not null check (channel in ('email','sms','phone')),
  participant_address text not null,
  subject text,
  status text not null default 'open' check (status in ('open','closed')),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  webhook_token_hash text
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.contact_threads(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound')),
  body text not null,
  provider_message_id text,
  sent_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  webhook_token_hash text
);

create table if not exists private.keyid_material (
  study_id uuid primary key references public.studies(id) on delete cascade,
  key_seed text not null,
  webhook_token text not null,
  created_at timestamptz not null default now()
);

create index if not exists responses_study_id_idx on public.responses(study_id);
create index if not exists assignments_study_id_idx on public.assignments(study_id);
create index if not exists assignments_response_id_idx on public.assignments(response_id);
create index if not exists notifications_study_id_idx on public.notifications(study_id);

alter table public.studies enable row level security;
alter table public.responses enable row level security;
alter table public.assignments enable row level security;
alter table public.notifications enable row level security;
alter table public.researcher_profiles enable row level security;
alter table public.study_contact_channels enable row level security;
alter table public.contact_threads enable row level security;
alter table public.contact_messages enable row level security;
alter table private.keyid_material enable row level security;

create or replace function public.set_updated_at()
returns trigger language plpgsql
security invoker
set search_path = pg_catalog, public
as $$ begin new.updated_at = now(); return new; end; $$;

drop policy if exists "owners manage studies" on public.studies;
create policy "owners manage studies" on public.studies for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "public reads published studies" on public.studies;
create policy "public reads published studies" on public.studies for select to anon
using (status = 'published');

drop policy if exists "public submits to published studies" on public.responses;
create policy "public submits to published studies" on public.responses for insert to anon
with check (exists (select 1 from public.studies s where s.id=responses.study_id and s.status='published'));

drop policy if exists "owners read responses" on public.responses;
create policy "owners read responses" on public.responses for select to authenticated
using (exists (select 1 from public.studies s where s.id=responses.study_id and s.owner_id=(select auth.uid())));
drop policy if exists "owners insert responses" on public.responses;
create policy "owners insert responses" on public.responses for insert to authenticated
with check (exists (select 1 from public.studies s where s.id=responses.study_id and s.owner_id=(select auth.uid())));
drop policy if exists "owners update responses" on public.responses;
create policy "owners update responses" on public.responses for update to authenticated
using (exists (select 1 from public.studies s where s.id=responses.study_id and s.owner_id=(select auth.uid())))
with check (exists (select 1 from public.studies s where s.id=responses.study_id and s.owner_id=(select auth.uid())));
drop policy if exists "owners delete responses" on public.responses;
create policy "owners delete responses" on public.responses for delete to authenticated
using (exists (select 1 from public.studies s where s.id=responses.study_id and s.owner_id=(select auth.uid())));

drop policy if exists "owners manage assignments" on public.assignments;
create policy "owners manage assignments" on public.assignments for all to authenticated
using (exists (select 1 from public.studies s where s.id=assignments.study_id and s.owner_id=(select auth.uid())))
with check (exists (select 1 from public.studies s where s.id=assignments.study_id and s.owner_id=(select auth.uid())));

drop policy if exists "owners manage notifications" on public.notifications;
create policy "owners manage notifications" on public.notifications for all to authenticated
using (exists (select 1 from public.studies s where s.id=notifications.study_id and s.owner_id=(select auth.uid())))
with check (exists (select 1 from public.studies s where s.id=notifications.study_id and s.owner_id=(select auth.uid())));

drop policy if exists "researchers manage own profile" on public.researcher_profiles;
create policy "researchers manage own profile" on public.researcher_profiles for all to authenticated
using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

drop policy if exists "owners manage study channels" on public.study_contact_channels;
create policy "owners manage study channels" on public.study_contact_channels for all to authenticated
using (exists (select 1 from public.studies s where s.id=study_contact_channels.study_id and s.owner_id=(select auth.uid())))
with check (exists (select 1 from public.studies s where s.id=study_contact_channels.study_id and s.owner_id=(select auth.uid())));

drop policy if exists "owners manage contact threads" on public.contact_threads;
create policy "owners manage contact threads" on public.contact_threads for all to authenticated
using (exists (select 1 from public.studies s where s.id=contact_threads.study_id and s.owner_id=(select auth.uid())))
with check (exists (select 1 from public.studies s where s.id=contact_threads.study_id and s.owner_id=(select auth.uid())));

drop policy if exists "owners manage contact messages" on public.contact_messages;
create policy "owners manage contact messages" on public.contact_messages for all to authenticated
using (exists (select 1 from public.contact_threads t join public.studies s on s.id=t.study_id where t.id=contact_messages.thread_id and s.owner_id=(select auth.uid())))
with check (exists (select 1 from public.contact_threads t join public.studies s on s.id=t.study_id where t.id=contact_messages.thread_id and s.owner_id=(select auth.uid())));

drop policy if exists "owners manage keyid material" on private.keyid_material;
create policy "owners manage keyid material" on private.keyid_material for all to authenticated
using (exists (select 1 from public.studies s where s.id=keyid_material.study_id and s.owner_id=(select auth.uid())))
with check (exists (select 1 from public.studies s where s.id=keyid_material.study_id and s.owner_id=(select auth.uid())));

create or replace function private.valid_keyid_webhook(p_study_id uuid, p_hash text)
returns boolean language sql stable security definer set search_path=pg_catalog,public
as $$ select exists(select 1 from public.study_contact_channels c where c.study_id=p_study_id and c.provider='keyid' and c.status='active' and c.config->>'webhook_token_hash'=p_hash); $$;
create or replace function private.valid_keyid_webhook_thread(p_thread_id uuid, p_hash text)
returns boolean language sql stable security definer set search_path=pg_catalog,public
as $$ select exists(select 1 from public.contact_threads t join public.study_contact_channels c on c.study_id=t.study_id where t.id=p_thread_id and c.provider='keyid' and c.status='active' and c.config->>'webhook_token_hash'=p_hash); $$;
revoke all on function private.valid_keyid_webhook(uuid,text) from public;
revoke all on function private.valid_keyid_webhook_thread(uuid,text) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.valid_keyid_webhook(uuid,text) to anon;
grant execute on function private.valid_keyid_webhook_thread(uuid,text) to anon;

drop policy if exists "keyid webhook inserts threads" on public.contact_threads;
create policy "keyid webhook inserts threads" on public.contact_threads for insert to anon
with check (private.valid_keyid_webhook(study_id,webhook_token_hash));
drop policy if exists "keyid webhook inserts messages" on public.contact_messages;
create policy "keyid webhook inserts messages" on public.contact_messages for insert to anon
with check (private.valid_keyid_webhook_thread(thread_id,webhook_token_hash));

grant usage on schema public to anon, authenticated;
grant select on public.studies to anon;
grant insert on public.responses, public.contact_threads, public.contact_messages to anon;
grant select, insert, update, delete on public.studies, public.responses, public.assignments, public.notifications,
  public.researcher_profiles, public.study_contact_channels, public.contact_threads, public.contact_messages to authenticated;
grant select, insert, update on private.keyid_material to authenticated;

create or replace function public.ensure_keyid_material(p_study_id uuid)
returns table(key_seed text, webhook_token text)
language plpgsql security invoker set search_path=pg_catalog,public,private
as $$
begin
  if not exists(select 1 from public.studies s where s.id=p_study_id and s.owner_id=(select auth.uid())) then
    raise exception 'Study not found or not owned by current researcher';
  end if;
  insert into private.keyid_material(study_id,key_seed,webhook_token)
  values(p_study_id,encode(gen_random_bytes(32),'hex'),encode(gen_random_bytes(32),'hex'))
  on conflict(study_id) do nothing;
  return query select m.key_seed,m.webhook_token from private.keyid_material m where m.study_id=p_study_id;
end; $$;
revoke all on function public.ensure_keyid_material(uuid) from public;
grant execute on function public.ensure_keyid_material(uuid) to authenticated;

-- The full demo-study seed function is maintained in 20260815_multitenant_keyid_demo.sql.
