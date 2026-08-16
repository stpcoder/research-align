create or replace function public.google_calendar_status_for_user(p_user_id uuid)
returns table(connected boolean, scope text, calendar_id text)
language sql
security definer
set search_path = ''
as $$
  select true, c.scope, c.calendar_id
  from private.google_calendar_connections c
  where c.user_id = p_user_id;
$$;
revoke all on function public.google_calendar_status_for_user(uuid) from public, anon, authenticated;
grant execute on function public.google_calendar_status_for_user(uuid) to service_role;
