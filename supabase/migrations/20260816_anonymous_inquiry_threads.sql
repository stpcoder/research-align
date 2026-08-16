alter table public.contact_threads
  add column if not exists source text not null default 'participant',
  add column if not exists requester_name text;

alter table public.contact_threads
  drop constraint if exists contact_threads_status_check;

alter table public.contact_threads
  add constraint contact_threads_status_check
  check (status = any (array['pending'::text,'open'::text,'closed'::text]));

alter table public.contact_threads
  drop constraint if exists contact_threads_source_check;

alter table public.contact_threads
  add constraint contact_threads_source_check
  check (source = any (array['participant'::text,'public_inquiry'::text]));

create unique index if not exists contact_threads_public_inquiry_open_uidx
  on public.contact_threads(study_id, lower(participant_address))
  where source='public_inquiry' and channel='email' and status <> 'closed';

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
  v_name text := left(trim(coalesce(p_name,'')), 80);
  v_message text := trim(coalesce(p_message,''));
  v_thread uuid;
  v_status text;
begin
  if not exists (
    select 1 from public.studies s
    where s.id=p_study_id and s.status='published'
  ) then
    raise exception '현재 문의를 받을 수 없는 실험입니다.';
  end if;

  if length(v_name) < 1 then raise exception '이름을 입력해주세요.'; end if;
  if length(v_email) > 254 or v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception '올바른 이메일 주소를 입력해주세요.';
  end if;
  if length(v_message) < 2 then raise exception '문의 내용을 입력해주세요.'; end if;
  if length(v_message) > 4000 then raise exception '문의 내용은 4000자 이내로 입력해주세요.'; end if;

  select t.id, t.status into v_thread, v_status
  from public.contact_threads t
  where t.study_id=p_study_id
    and t.channel='email'
    and t.source='public_inquiry'
    and lower(t.participant_address)=v_email
    and t.status <> 'closed'
  order by t.created_at desc
  limit 1;

  if v_thread is null then
    begin
      insert into public.contact_threads(
        study_id,response_id,channel,participant_address,requester_name,subject,status,source,last_message_at
      ) values (
        p_study_id,null,'email',v_email,v_name,'이메일 문의','pending','public_inquiry',now()
      ) returning id, contact_threads.status into v_thread, v_status;
    exception when unique_violation then
      select t.id, t.status into v_thread, v_status
      from public.contact_threads t
      where t.study_id=p_study_id
        and t.channel='email'
        and t.source='public_inquiry'
        and lower(t.participant_address)=v_email
        and t.status <> 'closed'
      order by t.created_at desc
      limit 1;
    end;
  end if;

  if exists (
    select 1 from public.contact_messages m
    where m.thread_id=v_thread
      and m.direction='inbound'
      and m.metadata->>'source'='public_inquiry'
      and m.sent_at > now() - interval '4 seconds'
  ) then
    raise exception '잠시 후 다시 보내주세요.';
  end if;

  update public.contact_threads
  set requester_name=v_name, status='pending', last_message_at=now()
  where id=v_thread;

  insert into public.contact_messages(thread_id,direction,body,sent_at,metadata)
  values (
    v_thread,'inbound',v_message,now(),
    jsonb_build_object('source','public_inquiry','requester_name',v_name,'email',v_email)
  );

  return query select v_thread, 'pending'::text;
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
begin
  if new.contact_email is not null and trim(new.contact_email) <> '' then
    update public.contact_threads t
    set response_id=new.id
    where t.study_id=new.study_id
      and t.source='public_inquiry'
      and t.channel='email'
      and t.response_id is null
      and t.status <> 'closed'
      and lower(t.participant_address)=lower(trim(new.contact_email));
  end if;
  return new;
end;
$$;

revoke all on function public.link_public_inquiry_to_response() from public, anon, authenticated;

drop trigger if exists link_public_inquiry_to_response_after_write on public.responses;
create trigger link_public_inquiry_to_response_after_write
after insert or update of contact_email on public.responses
for each row execute function public.link_public_inquiry_to_response();
