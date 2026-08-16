alter table public.study_contact_channels
  drop constraint if exists study_contact_channels_provider_check;

alter table public.study_contact_channels
  add constraint study_contact_channels_provider_check
  check (provider = any (array['manual'::text, 'keyid'::text, 'clawmail'::text]));

create table if not exists private.clawmail_material (
  study_id uuid primary key references public.studies(id) on delete cascade,
  inbox_id text not null unique,
  address text not null unique,
  api_token text not null,
  owner_email text,
  account_id text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.clawmail_material enable row level security;
revoke all on table private.clawmail_material from public, anon, authenticated;

create unique index if not exists contact_messages_thread_provider_message_uidx
  on public.contact_messages(thread_id, provider_message_id)
  where provider_message_id is not null;

create or replace function public.clawmail_get_material(p_study_id uuid)
returns table(
  inbox_id text,
  address text,
  api_token text,
  owner_email text,
  account_id text,
  last_synced_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select m.inbox_id, m.address, m.api_token, m.owner_email, m.account_id, m.last_synced_at
  from private.clawmail_material m
  where m.study_id = p_study_id;
$$;

revoke all on function public.clawmail_get_material(uuid) from public, anon, authenticated;
grant execute on function public.clawmail_get_material(uuid) to service_role;

create or replace function public.clawmail_put_material(
  p_study_id uuid,
  p_inbox_id text,
  p_address text,
  p_api_token text,
  p_owner_email text,
  p_account_id text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.clawmail_material(study_id, inbox_id, address, api_token, owner_email, account_id, updated_at)
  values (p_study_id, p_inbox_id, p_address, p_api_token, p_owner_email, nullif(p_account_id, ''), now())
  on conflict (study_id) do update set
    inbox_id = excluded.inbox_id,
    address = excluded.address,
    api_token = excluded.api_token,
    owner_email = excluded.owner_email,
    account_id = excluded.account_id,
    updated_at = now();
$$;

revoke all on function public.clawmail_put_material(uuid,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.clawmail_put_material(uuid,text,text,text,text,text) to service_role;

create or replace function public.clawmail_touch_material(p_study_id uuid, p_synced_at timestamptz)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.clawmail_material
  set last_synced_at = p_synced_at,
      updated_at = now()
  where study_id = p_study_id;
$$;

revoke all on function public.clawmail_touch_material(uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.clawmail_touch_material(uuid,timestamptz) to service_role;
