-- Run this script in your Supabase Dashboard -> SQL Editor
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) > 0),
  description text not null default '',
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

drop policy if exists "Allow full CRUD access on tasks" on public.tasks;
create policy "Allow full CRUD access on tasks"
  on public.tasks
  for all
  to anon, authenticated
  using (true)
  with check (true);
