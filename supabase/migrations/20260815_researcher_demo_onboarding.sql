alter table public.researcher_profiles
  add column if not exists demo_seeded boolean not null default false;
