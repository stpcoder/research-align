create or replace function public.get_public_busy_intervals(p_study_id uuid)
returns table(starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.starts_at, a.ends_at
  from public.assignments a
  join public.studies s on s.id = a.study_id
  where a.study_id = p_study_id
    and s.status = 'published'
    and a.status in ('draft','confirmed','completed');
$$;
revoke all on function public.get_public_busy_intervals(uuid) from public;
grant execute on function public.get_public_busy_intervals(uuid) to anon, authenticated;

create table if not exists private.google_calendar_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  scope text not null default 'https://www.googleapis.com/auth/calendar.freebusy',
  calendar_id text not null default 'primary',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table private.google_calendar_connections enable row level security;
revoke all on table private.google_calendar_connections from public, anon, authenticated;

create table if not exists private.google_calendar_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  study_id uuid references public.studies(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
alter table private.google_calendar_oauth_states enable row level security;
revoke all on table private.google_calendar_oauth_states from public, anon, authenticated;

create or replace function public.google_calendar_store_state(p_state text, p_user_id uuid, p_study_id uuid, p_expires_at timestamptz)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.google_calendar_oauth_states(state,user_id,study_id,expires_at)
  values (p_state,p_user_id,p_study_id,p_expires_at)
  on conflict (state) do update set user_id=excluded.user_id, study_id=excluded.study_id, expires_at=excluded.expires_at, used_at=null;
$$;
revoke all on function public.google_calendar_store_state(text,uuid,uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.google_calendar_store_state(text,uuid,uuid,timestamptz) to service_role;

create or replace function public.google_calendar_consume_state(p_state text)
returns table(user_id uuid, study_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update private.google_calendar_oauth_states s
     set used_at = now()
   where s.state = p_state
     and s.used_at is null
     and s.expires_at > now()
  returning s.user_id, s.study_id;
end;
$$;
revoke all on function public.google_calendar_consume_state(text) from public, anon, authenticated;
grant execute on function public.google_calendar_consume_state(text) to service_role;

create or replace function public.google_calendar_put_connection(p_user_id uuid, p_refresh_token text, p_scope text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.google_calendar_connections(user_id,refresh_token,scope,updated_at)
  values (p_user_id,p_refresh_token,coalesce(nullif(p_scope,''),'https://www.googleapis.com/auth/calendar.freebusy'),now())
  on conflict (user_id) do update set refresh_token=excluded.refresh_token, scope=excluded.scope, updated_at=now();
$$;
revoke all on function public.google_calendar_put_connection(uuid,text,text) from public, anon, authenticated;
grant execute on function public.google_calendar_put_connection(uuid,text,text) to service_role;

create or replace function public.google_calendar_get_connection(p_user_id uuid)
returns table(refresh_token text, scope text, calendar_id text)
language sql
security definer
set search_path = ''
as $$
  select c.refresh_token,c.scope,c.calendar_id
  from private.google_calendar_connections c
  where c.user_id = p_user_id;
$$;
revoke all on function public.google_calendar_get_connection(uuid) from public, anon, authenticated;
grant execute on function public.google_calendar_get_connection(uuid) to service_role;

create or replace function public.google_calendar_delete_connection(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$ delete from private.google_calendar_connections where user_id = p_user_id; $$;
revoke all on function public.google_calendar_delete_connection(uuid) from public, anon, authenticated;
grant execute on function public.google_calendar_delete_connection(uuid) to service_role;
