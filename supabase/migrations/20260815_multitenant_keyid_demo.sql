create schema if not exists private;

alter table public.contact_threads
  add column if not exists webhook_token_hash text;

alter table public.contact_messages
  add column if not exists webhook_token_hash text;

create or replace function private.valid_keyid_webhook(p_study_id uuid, p_hash text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.study_contact_channels c
    where c.study_id = p_study_id
      and c.provider = 'keyid'
      and c.status = 'active'
      and c.config->>'webhook_token_hash' = p_hash
  );
$$;

create or replace function private.valid_keyid_webhook_thread(p_thread_id uuid, p_hash text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.contact_threads t
    join public.study_contact_channels c on c.study_id = t.study_id
    where t.id = p_thread_id
      and c.provider = 'keyid'
      and c.status = 'active'
      and c.config->>'webhook_token_hash' = p_hash
  );
$$;

revoke all on function private.valid_keyid_webhook(uuid, text) from public;
revoke all on function private.valid_keyid_webhook_thread(uuid, text) from public;
grant usage on schema private to anon;
grant execute on function private.valid_keyid_webhook(uuid, text) to anon;
grant execute on function private.valid_keyid_webhook_thread(uuid, text) to anon;

drop policy if exists "keyid webhook inserts threads" on public.contact_threads;
create policy "keyid webhook inserts threads"
on public.contact_threads
for insert
to anon
with check (private.valid_keyid_webhook(study_id, webhook_token_hash));

drop policy if exists "keyid webhook inserts messages" on public.contact_messages;
create policy "keyid webhook inserts messages"
on public.contact_messages
for insert
to anon
with check (private.valid_keyid_webhook_thread(thread_id, webhook_token_hash));

grant insert on public.contact_threads, public.contact_messages to anon;

create or replace function public.create_demo_study()
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_owner uuid := (select auth.uid());
  v_study uuid := gen_random_uuid();
  v_name uuid := gen_random_uuid();
  v_email uuid := gen_random_uuid();
  v_phone uuid := gen_random_uuid();
  v_contact uuid := gen_random_uuid();
  v_training uuid := gen_random_uuid();
  v_experiment uuid := gen_random_uuid();
  r1 uuid := gen_random_uuid();
  r2 uuid := gen_random_uuid();
  r3 uuid := gen_random_uuid();
  r4 uuid := gen_random_uuid();
  t1 uuid := gen_random_uuid();
  d1 text := (current_date + 2)::text;
  d2 text := (current_date + 3)::text;
  d3 text := (current_date + 4)::text;
  v_slug text := 'demo-human-ai-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 7);
begin
  if v_owner is null then
    raise exception 'Authentication required';
  end if;

  insert into public.researcher_profiles(user_id, display_name, organization)
  values (v_owner, 'Demo Researcher', 'Research Lab')
  on conflict (user_id) do nothing;

  insert into public.studies(id, owner_id, title, slug, description, status, form_config, scheduling_config)
  values (
    v_study,
    v_owner,
    'Human–AI Learning Study · Demo',
    v_slug,
    '교육 세션과 본 실험이 순서대로 진행되는 샘플 연구입니다. 참가자는 가능한 시간을 제출하고 연구자가 최종 배정합니다.',
    'published',
    jsonb_build_object('fields', jsonb_build_array(
      jsonb_build_object('id',v_name::text,'type','short','label','이름','required',true),
      jsonb_build_object('id',v_email::text,'type','email','label','이메일','required',true,'description','일정 확정 및 변경 안내에 사용합니다.'),
      jsonb_build_object('id',v_phone::text,'type','phone','label','전화번호','required',false,'description','SMS 안내를 원하는 경우 입력해주세요.'),
      jsonb_build_object('id',v_contact::text,'type','radio','label','선호 연락 수단','required',true,'options',jsonb_build_array('이메일','SMS')),
      jsonb_build_object('id',v_training::text,'type','availability','label','사전 교육 가능한 시간','required',true,'sessionKey','training','sessionLabel','사전 교육','duration',30,'stepMinutes',30,'min',3,'max',8,'rankTop',2,'dates',jsonb_build_array(d1,d2),'hours','10:00-17:00'),
      jsonb_build_object('id',v_experiment::text,'type','availability','label','본 실험 가능한 시간','required',true,'sessionKey','experiment','sessionLabel','본 실험','duration',90,'stepMinutes',30,'min',3,'max',8,'rankTop',3,'dates',jsonb_build_array(d2,d3),'hours','10:00-18:00')
    )),
    jsonb_build_object(
      'maxSessionsPerDay', 1,
      'sessionOrder', jsonb_build_array('training','experiment'),
      'preferences', jsonb_build_object('longSessionsEarlier',true,'participantRankingWeight','high','compactScheduleWeight','medium')
    )
  );

  insert into public.responses(id, study_id, answers, availability, preferences, contact_email, contact_phone)
  values
  (r1, v_study,
    jsonb_build_object(v_name::text,'김민지',v_email::text,'minji.demo@example.com',v_phone::text,'010-0000-1001',v_contact::text,'이메일'),
    jsonb_build_object(v_training::text,jsonb_build_array(d1||'T10:00',d1||'T10:30',d1||'T11:00',d2||'T10:00'),v_experiment::text,jsonb_build_array(d2||'T13:00',d2||'T14:00',d3||'T10:00',d3||'T13:00')),
    jsonb_build_object(v_training::text,jsonb_build_object('1',d1||'T10:00','2',d1||'T10:30'),v_experiment::text,jsonb_build_object('1',d2||'T13:00','2',d3||'T10:00','3',d2||'T14:00')),
    'minji.demo@example.com','010-0000-1001'),
  (r2, v_study,
    jsonb_build_object(v_name::text,'박준호',v_email::text,'junho.demo@example.com',v_phone::text,'010-0000-1002',v_contact::text,'SMS'),
    jsonb_build_object(v_training::text,jsonb_build_array(d1||'T11:00',d1||'T11:30',d2||'T10:30'),v_experiment::text,jsonb_build_array(d2||'T15:00',d3||'T11:00',d3||'T14:00')),
    jsonb_build_object(v_training::text,jsonb_build_object('1',d1||'T11:00','2',d2||'T10:30'),v_experiment::text,jsonb_build_object('1',d3||'T11:00','2',d2||'T15:00','3',d3||'T14:00')),
    'junho.demo@example.com','010-0000-1002'),
  (r3, v_study,
    jsonb_build_object(v_name::text,'이서연',v_email::text,'seoyeon.demo@example.com',v_phone::text,'010-0000-1003',v_contact::text,'이메일'),
    jsonb_build_object(v_training::text,jsonb_build_array(d1||'T14:00',d1||'T14:30',d2||'T11:00'),v_experiment::text,jsonb_build_array(d2||'T10:00',d2||'T11:30',d3||'T15:00')),
    jsonb_build_object(v_training::text,jsonb_build_object('1',d1||'T14:00'),v_experiment::text,jsonb_build_object('1',d2||'T10:00','2',d2||'T11:30')),
    'seoyeon.demo@example.com','010-0000-1003'),
  (r4, v_study,
    jsonb_build_object(v_name::text,'최도윤',v_email::text,'doyoon.demo@example.com',v_phone::text,'010-0000-1004',v_contact::text,'SMS'),
    jsonb_build_object(v_training::text,jsonb_build_array(d1||'T15:00',d2||'T13:00',d2||'T13:30'),v_experiment::text,jsonb_build_array(d2||'T14:00',d3||'T10:30',d3||'T13:00')),
    jsonb_build_object(v_training::text,jsonb_build_object('1',d2||'T13:00'),v_experiment::text,jsonb_build_object('1',d3||'T10:30','2',d2||'T14:00')),
    'doyoon.demo@example.com','010-0000-1004');

  insert into public.assignments(study_id,response_id,session_key,session_label,starts_at,ends_at,status)
  values
  (v_study,r1,'training','사전 교육',((current_date + 2) + time '10:00') at time zone 'Asia/Seoul',((current_date + 2) + time '10:30') at time zone 'Asia/Seoul','confirmed'),
  (v_study,r1,'experiment','본 실험',((current_date + 3) + time '13:00') at time zone 'Asia/Seoul',((current_date + 3) + time '14:30') at time zone 'Asia/Seoul','confirmed'),
  (v_study,r2,'training','사전 교육',((current_date + 2) + time '11:00') at time zone 'Asia/Seoul',((current_date + 2) + time '11:30') at time zone 'Asia/Seoul','draft');

  insert into public.contact_threads(id,study_id,response_id,channel,participant_address,subject,status,last_message_at)
  values (t1,v_study,r2,'email','junho.demo@example.com','실험 장소 문의','open',now());

  insert into public.contact_messages(thread_id,direction,body,provider_message_id,sent_at,metadata)
  values
  (t1,'inbound','안녕하세요. 실험 장소가 확정되었는지 궁금합니다.','demo-in-1',now()-interval '12 minutes',jsonb_build_object('sample',true)),
  (t1,'outbound','네, 일정 확정 시 장소와 함께 다시 안내드리겠습니다.','demo-out-1',now()-interval '7 minutes',jsonb_build_object('sample',true));

  return v_study;
end;
$$;

revoke all on function public.create_demo_study() from public;
grant execute on function public.create_demo_study() to authenticated;
