alter table public.assignments
  drop constraint if exists assignments_status_check;

alter table public.assignments
  add constraint assignments_status_check
  check (status = any (array['confirmed'::text,'completed'::text,'cancelled'::text,'no_show'::text]));

create or replace function public.prevent_owner_schedule_overlap()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_owner uuid;
  v_conflict record;
begin
  if current_setting('studyform.allow_demo_overlap', true) = 'on' then return new; end if;
  if new.status <> 'confirmed' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'confirmed' and old.study_id = new.study_id and old.starts_at = new.starts_at and old.ends_at = new.ends_at then return new; end if;

  select s.owner_id into v_owner from public.studies s where s.id = new.study_id;
  select a.id, s.title, a.session_label, a.starts_at, a.ends_at
  into v_conflict
  from public.assignments a
  join public.studies s on s.id = a.study_id
  where s.owner_id = v_owner
    and a.id <> new.id
    and a.status in ('confirmed','completed','no_show')
    and a.starts_at < new.ends_at
    and a.ends_at > new.starts_at
  order by a.starts_at
  limit 1;

  if v_conflict.id is not null then
    raise exception using errcode='23P01', message=format('다른 StudyForm 일정과 시간이 겹칩니다: %s · %s',v_conflict.title,v_conflict.session_label);
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_owner_schedule_overlap_before_write on public.assignments;
create trigger prevent_owner_schedule_overlap_before_write
before insert or update of study_id, starts_at, ends_at, status on public.assignments
for each row execute function public.prevent_owner_schedule_overlap();

create or replace function public.get_public_busy_intervals(p_study_id uuid)
returns table(starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.starts_at, a.ends_at
  from public.studies target
  join public.studies owned on owned.owner_id = target.owner_id
  join public.assignments a on a.study_id = owned.id
  where target.id = p_study_id
    and target.status = 'published'
    and a.status in ('confirmed','completed','no_show');
$$;

revoke all on function public.get_public_busy_intervals(uuid) from public;
grant execute on function public.get_public_busy_intervals(uuid) to anon, authenticated;

update public.studies s
set form_config = jsonb_set(s.form_config,'{fields}',coalesce((
  select jsonb_agg(
    case when f.value->>'type'='phone' and coalesce(f.value->>'description','') ~* '(sms|문자)'
      then jsonb_set(f.value,'{description}',to_jsonb('필요 시 연구자가 직접 연락할 수 있는 번호입니다.'::text),true)
      else f.value end
    order by f.ord)
  from jsonb_array_elements(coalesce(s.form_config->'fields','[]'::jsonb)) with ordinality as f(value,ord)
  where not (
    f.value->>'type'='radio'
    and coalesce(f.value->>'label','') ~* '(일정.*안내|선호.*연락|안내.*방법)'
    and exists (select 1 from jsonb_array_elements_text(coalesce(f.value->'options','[]'::jsonb)) as o(value) where o.value ~* '(sms|문자)')
  )
),'[]'::jsonb),true)
where exists (
  select 1 from jsonb_array_elements(coalesce(s.form_config->'fields','[]'::jsonb)) as f(value)
  where (f.value->>'type'='phone' and coalesce(f.value->>'description','') ~* '(sms|문자)')
     or (f.value->>'type'='radio' and coalesce(f.value->>'label','') ~* '(일정.*안내|선호.*연락|안내.*방법)')
);

do $$
begin
  if to_regprocedure('public.create_demo_study_legacy()') is null and to_regprocedure('public.create_demo_study()') is not null then
    alter function public.create_demo_study() rename to create_demo_study_legacy;
  end if;
end $$;

create or replace function public.create_demo_study()
returns uuid
language plpgsql
security definer
set search_path = 'pg_catalog','public'
as $$
declare v_study uuid;
begin
  perform set_config('studyform.allow_demo_overlap','on',true);
  v_study := public.create_demo_study_legacy();
  update public.studies s
  set form_config=jsonb_set(s.form_config,'{fields}',coalesce((
    select jsonb_agg(
      case when f.value->>'type'='phone' then jsonb_set(f.value,'{description}',to_jsonb('필요 시 연구자가 직접 연락할 수 있는 번호입니다.'::text),true) else f.value end
      order by f.ord)
    from jsonb_array_elements(coalesce(s.form_config->'fields','[]'::jsonb)) with ordinality as f(value,ord)
    where not (f.value->>'type'='radio' and coalesce(f.value->>'label','') ~* '(일정.*안내|선호.*연락|안내.*방법)')
  ),'[]'::jsonb),true)
  where s.id=v_study;
  return v_study;
end;
$$;

revoke all on function public.create_demo_study_legacy() from public, anon, authenticated;
revoke all on function public.create_demo_study() from public;
grant execute on function public.create_demo_study() to authenticated;
