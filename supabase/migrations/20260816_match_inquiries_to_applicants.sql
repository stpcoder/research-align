create or replace function private.match_inquiry_response(
  p_study_id uuid,
  p_email text,
  p_name text
)
returns table(response_id uuid, matched_by text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_email,'')));
  v_name text := lower(regexp_replace(trim(coalesce(p_name,'')), '\s+', ' ', 'g'));
  v_name_field text;
  v_ids uuid[];
begin
  select coalesce(
    (
      select f.value->>'id'
      from jsonb_array_elements(coalesce(s.form_config->'fields','[]'::jsonb)) with ordinality as f(value,ord)
      where f.value->>'type'='short'
        and coalesce(f.value->>'label','') ~* '(이름|name)'
      order by f.ord
      limit 1
    ),
    (
      select f.value->>'id'
      from jsonb_array_elements(coalesce(s.form_config->'fields','[]'::jsonb)) with ordinality as f(value,ord)
      where f.value->>'type'='short'
      order by f.ord
      limit 1
    )
  )
  into v_name_field
  from public.studies s
  where s.id=p_study_id;

  if v_email <> '' then
    select array_agg(r.id order by r.submitted_at desc)
    into v_ids
    from public.responses r
    where r.study_id=p_study_id
      and lower(trim(coalesce(r.contact_email,'')))=v_email;

    if coalesce(cardinality(v_ids),0)=1 then
      return query select v_ids[1], 'email'::text;
      return;
    elsif coalesce(cardinality(v_ids),0)>1 and v_name <> '' and v_name_field is not null then
      select array_agg(r.id order by r.submitted_at desc)
      into v_ids
      from public.responses r
      where r.study_id=p_study_id
        and lower(trim(coalesce(r.contact_email,'')))=v_email
        and lower(regexp_replace(trim(coalesce(r.answers->>v_name_field,'')), '\s+', ' ', 'g'))=v_name;
      if coalesce(cardinality(v_ids),0)=1 then
        return query select v_ids[1], 'email+name'::text;
        return;
      end if;
    end if;
  end if;

  if v_name <> '' and v_name_field is not null then
    select array_agg(r.id order by r.submitted_at desc)
    into v_ids
    from public.responses r
    where r.study_id=p_study_id
      and lower(regexp_replace(trim(coalesce(r.answers->>v_name_field,'')), '\s+', ' ', 'g'))=v_name;
    if coalesce(cardinality(v_ids),0)=1 then
      return query select v_ids[1], 'name'::text;
      return;
    end if;
  end if;
end;
$$;

revoke all on function private.match_inquiry_response(uuid,text,text) from public, anon, authenticated;
grant execute on function private.match_inquiry_response(uuid,text,text) to service_role;

create or replace function public.submit_public_inquiry(
  p_study_id uuid,
  p_name text,
  p_email text,
  p_message text
)
returns table(thread_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_email,'')));
  v_name text := left(trim(coalesce(p_name,'')),80);
  v_message text := trim(coalesce(p_message,''));
  v_thread uuid;
  v_status text;
  v_response uuid;
  v_matched_by text;
  v_response_email text;
  v_source text := 'public_inquiry';
begin
  if not exists (
    select 1 from public.studies s
    where s.id=p_study_id and s.status='published'
  ) then
    raise exception '현재 문의를 받을 수 없는 실험입니다.';
  end if;

  if length(v_name)<1 then raise exception '이름을 입력해주세요.'; end if;
  if length(v_email)>254 or v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception '올바른 이메일 주소를 입력해주세요.';
  end if;
  if length(v_message)<2 then raise exception '문의 내용을 입력해주세요.'; end if;
  if length(v_message)>4000 then raise exception '문의 내용은 4000자 이내로 입력해주세요.'; end if;

  select m.response_id,m.matched_by
  into v_response,v_matched_by
  from private.match_inquiry_response(p_study_id,v_email,v_name) m
  limit 1;

  select t.id,t.status
  into v_thread,v_status
  from public.contact_threads t
  where t.study_id=p_study_id
    and t.channel='email'
    and lower(t.participant_address)=v_email
    and t.status<>'closed'
  order by (t.response_id is not null) desc,t.last_message_at desc nulls last,t.created_at desc
  limit 1;

  if v_response is not null then
    select lower(trim(coalesce(r.contact_email,'')))
    into v_response_email
    from public.responses r
    where r.id=v_response;
    if v_response_email=v_email then v_source:='participant'; end if;
  end if;

  if v_thread is null then
    begin
      insert into public.contact_threads(
        study_id,response_id,channel,participant_address,requester_name,subject,status,source,last_message_at
      ) values (
        p_study_id,v_response,'email',v_email,v_name,'이메일 문의','pending',v_source,now()
      ) returning id,contact_threads.status into v_thread,v_status;
    exception when unique_violation then
      select t.id,t.status
      into v_thread,v_status
      from public.contact_threads t
      where t.study_id=p_study_id
        and t.channel='email'
        and lower(t.participant_address)=v_email
        and t.status<>'closed'
      order by t.created_at desc
      limit 1;
    end;
  end if;

  if v_response is not null then
    update public.contact_threads t
    set response_id=v_response,
        source=case when v_response_email=v_email then 'participant' else t.source end
    where t.id=v_thread;
  end if;

  if exists (
    select 1 from public.contact_messages m
    where m.thread_id=v_thread
      and m.direction='inbound'
      and m.metadata->>'source'='public_inquiry'
      and m.sent_at>now()-interval '4 seconds'
  ) then
    raise exception '잠시 후 다시 보내주세요.';
  end if;

  update public.contact_threads
  set requester_name=v_name,status='pending',last_message_at=now()
  where id=v_thread;

  insert into public.contact_messages(thread_id,direction,body,sent_at,metadata)
  values (
    v_thread,'inbound',v_message,now(),
    jsonb_build_object(
      'source','public_inquiry',
      'requester_name',v_name,
      'email',v_email,
      'matched_response_id',v_response,
      'matched_by',v_matched_by
    )
  );

  return query select v_thread,'pending'::text;
end;
$$;

revoke all on function public.submit_public_inquiry(uuid,text,text,text) from public;
grant execute on function public.submit_public_inquiry(uuid,text,text,text) to anon, authenticated;

create or replace function public.link_public_inquiry_to_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
  v_response uuid;
  v_matched_by text;
begin
  for t in
    select id,participant_address,requester_name
    from public.contact_threads
    where study_id=new.study_id
      and source='public_inquiry'
      and response_id is null
      and channel='email'
      and status<>'closed'
  loop
    select m.response_id,m.matched_by
    into v_response,v_matched_by
    from private.match_inquiry_response(new.study_id,t.participant_address,t.requester_name) m
    limit 1;

    if v_response=new.id then
      update public.contact_threads ct
      set response_id=new.id,
          source=case
            when lower(trim(coalesce(new.contact_email,'')))=lower(trim(t.participant_address)) then 'participant'
            else ct.source
          end
      where ct.id=t.id;
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function public.link_public_inquiry_to_response() from public,anon,authenticated;

drop trigger if exists link_public_inquiry_to_response_after_write on public.responses;
create trigger link_public_inquiry_to_response_after_write
after insert or update of contact_email,answers on public.responses
for each row execute function public.link_public_inquiry_to_response();

with matches as (
  select t.id,m.response_id,m.matched_by
  from public.contact_threads t
  cross join lateral private.match_inquiry_response(t.study_id,t.participant_address,t.requester_name) m
  where t.source='public_inquiry'
    and t.response_id is null
    and t.channel='email'
    and t.status<>'closed'
)
update public.contact_threads t
set response_id=m.response_id,
    source=case when m.matched_by in ('email','email+name') then 'participant' else t.source end
from matches m
where t.id=m.id;
