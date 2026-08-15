create table if not exists private.keyid_material (
  study_id uuid primary key references public.studies(id) on delete cascade,
  key_seed text not null,
  webhook_token text not null,
  created_at timestamptz not null default now()
);

alter table private.keyid_material enable row level security;

drop policy if exists "owners manage keyid material" on private.keyid_material;
create policy "owners manage keyid material"
on private.keyid_material
for all
to authenticated
using (exists (
  select 1 from public.studies s
  where s.id = keyid_material.study_id
    and s.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.studies s
  where s.id = keyid_material.study_id
    and s.owner_id = (select auth.uid())
));

grant usage on schema private to authenticated;
grant select, insert, update on private.keyid_material to authenticated;

create or replace function public.ensure_keyid_material(p_study_id uuid)
returns table(key_seed text, webhook_token text)
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
begin
  if not exists (
    select 1 from public.studies s
    where s.id = p_study_id and s.owner_id = (select auth.uid())
  ) then
    raise exception 'Study not found or not owned by current researcher';
  end if;

  insert into private.keyid_material(study_id, key_seed, webhook_token)
  values (
    p_study_id,
    encode(gen_random_bytes(32), 'hex'),
    encode(gen_random_bytes(32), 'hex')
  )
  on conflict (study_id) do nothing;

  return query
  select m.key_seed, m.webhook_token
  from private.keyid_material m
  where m.study_id = p_study_id;
end;
$$;

revoke all on function public.ensure_keyid_material(uuid) from public;
grant execute on function public.ensure_keyid_material(uuid) to authenticated;
