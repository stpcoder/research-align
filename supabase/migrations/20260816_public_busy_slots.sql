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
    and a.status in ('confirmed','completed');
$$;

revoke all on function public.get_public_busy_intervals(uuid) from public;
grant execute on function public.get_public_busy_intervals(uuid) to anon, authenticated;
