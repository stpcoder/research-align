create or replace function public.ensure_keyid_material(p_study_id uuid)
returns table(key_seed text, webhook_token text)
language plpgsql
security invoker
set search_path = pg_catalog, public, private, extensions
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
    encode(extensions.gen_random_bytes(32), 'hex'),
    encode(extensions.gen_random_bytes(32), 'hex')
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
