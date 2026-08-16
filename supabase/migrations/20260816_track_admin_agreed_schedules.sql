alter table public.assignments
  add column if not exists scheduling_source text not null default 'participant_selection',
  add column if not exists agreement_confirmed_at timestamptz;

alter table public.assignments
  drop constraint if exists assignments_scheduling_source_check;

alter table public.assignments
  add constraint assignments_scheduling_source_check
  check (scheduling_source in ('participant_selection','admin_agreed'));

update public.assignments
set scheduling_source = 'participant_selection'
where scheduling_source is null;
