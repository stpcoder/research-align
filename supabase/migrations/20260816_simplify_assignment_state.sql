update public.assignments set status='confirmed' where status='draft';

create or replace function public.normalize_assignment_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'draft' then
    new.status := 'confirmed';
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_assignment_status_before_write on public.assignments;
create trigger normalize_assignment_status_before_write
before insert or update on public.assignments
for each row execute function public.normalize_assignment_status();

alter table public.assignments drop constraint if exists assignments_status_check;
alter table public.assignments add constraint assignments_status_check
check (status = any(array['confirmed'::text,'completed'::text,'cancelled'::text]));
