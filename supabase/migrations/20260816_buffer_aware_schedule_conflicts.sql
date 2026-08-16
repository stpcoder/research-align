create or replace function public.prevent_owner_schedule_overlap()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_owner uuid;
  v_new_buffer integer := 0;
  v_conflict record;
begin
  if current_setting('studyform.allow_demo_overlap', true) = 'on' then return new; end if;
  if new.status <> 'confirmed' then return new; end if;

  select s.owner_id,
         coalesce((
           select case when coalesce(f.value->>'bufferMinutes','') ~ '^\d+$' then (f.value->>'bufferMinutes')::integer else 0 end
           from jsonb_array_elements(coalesce(s.form_config->'fields','[]'::jsonb)) as f(value)
           where f.value->>'type'='availability'
             and coalesce(f.value->>'sessionKey',f.value->>'id') = new.session_key
           limit 1
         ),0)
  into v_owner, v_new_buffer
  from public.studies s
  where s.id = new.study_id;

  if tg_op = 'UPDATE'
     and old.status = 'confirmed'
     and old.study_id = new.study_id
     and old.starts_at = new.starts_at
     and old.ends_at = new.ends_at then
    return new;
  end if;

  select a.id, s.title, a.session_label, a.starts_at, a.ends_at
  into v_conflict
  from public.assignments a
  join public.studies s on s.id = a.study_id
  where s.owner_id = v_owner
    and a.id <> new.id
    and a.status in ('confirmed','completed','no_show')
    and a.starts_at < new.ends_at + (v_new_buffer * interval '1 minute')
    and a.ends_at + (
      coalesce((
        select case when coalesce(f.value->>'bufferMinutes','') ~ '^\d+$' then (f.value->>'bufferMinutes')::integer else 0 end
        from jsonb_array_elements(coalesce(s.form_config->'fields','[]'::jsonb)) as f(value)
        where f.value->>'type'='availability'
          and coalesce(f.value->>'sessionKey',f.value->>'id') = a.session_key
        limit 1
      ),0) * interval '1 minute'
    ) > new.starts_at
  order by a.starts_at
  limit 1;

  if v_conflict.id is not null then
    raise exception using
      errcode='23P01',
      message=format('다른 StudyForm 일정 또는 준비시간과 겹칩니다: %s · %s',v_conflict.title,v_conflict.session_label);
  end if;
  return new;
end;
$$;

create or replace function public.get_public_busy_intervals(p_study_id uuid)
returns table(starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.starts_at,
         a.ends_at + (
           coalesce((
             select case when coalesce(f.value->>'bufferMinutes','') ~ '^\d+$' then (f.value->>'bufferMinutes')::integer else 0 end
             from jsonb_array_elements(coalesce(owned.form_config->'fields','[]'::jsonb)) as f(value)
             where f.value->>'type'='availability'
               and coalesce(f.value->>'sessionKey',f.value->>'id') = a.session_key
             limit 1
           ),0) * interval '1 minute'
         ) as ends_at
  from public.studies target
  join public.studies owned on owned.owner_id = target.owner_id
  join public.assignments a on a.study_id = owned.id
  where target.id = p_study_id
    and target.status = 'published'
    and a.status in ('confirmed','completed','no_show');
$$;

revoke all on function public.get_public_busy_intervals(uuid) from public;
grant execute on function public.get_public_busy_intervals(uuid) to anon, authenticated;
