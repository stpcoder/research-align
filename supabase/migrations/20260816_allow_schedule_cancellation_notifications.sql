alter table public.notifications
  drop constraint if exists notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check
  check (kind = any (array['schedule_confirmation'::text,'schedule_cancellation'::text]));
