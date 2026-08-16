alter table public.notifications
  add column if not exists kind text not null default 'schedule_confirmation',
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.notifications
  drop constraint if exists notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('schedule_confirmation'));

create index if not exists notifications_assignment_created_idx
  on public.notifications(assignment_id, created_at desc);
