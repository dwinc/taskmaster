-- TASKMASTER — Supabase schema
-- Run this in your Supabase project (SQL Editor) once.
-- Single-user personal app; the publishable key is embedded in the client
-- so we use permissive RLS policies scoped to these two tables only.
-- When you add multi-user later, swap these for auth.uid() policies.

create extension if not exists "pgcrypto";

-- ---------- categories ----------
create table if not exists public.categories (
  id uuid primary key,
  name text not null,
  color text not null,
  icon text not null,
  position integer not null default 0,
  user_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists categories_user_idx on public.categories (user_name);
create index if not exists categories_position_idx on public.categories (position);

-- ---------- tasks ----------
create table if not exists public.tasks (
  id uuid primary key,
  category_id uuid not null references public.categories(id) on delete cascade,
  title text not null,
  description text not null default '',
  status text not null default 'not_done'
    check (status in ('not_done','in_progress','blocked','done')),
  deadline timestamptz,
  position integer not null default 0,
  user_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  tags text[] not null default '{}',
  subtasks jsonb not null default '[]'::jsonb
);

-- Migrations for existing installs (safe to re-run):
alter table public.tasks
  add column if not exists tags text[] not null default '{}';
alter table public.tasks
  add column if not exists subtasks jsonb not null default '[]'::jsonb;
alter table public.tasks
  add column if not exists on_today boolean not null default false;
alter table public.tasks
  add column if not exists today_position integer not null default 0;

create index if not exists tasks_category_idx on public.tasks (category_id);
create index if not exists tasks_status_idx on public.tasks (status);
create index if not exists tasks_deadline_idx on public.tasks (deadline);
create index if not exists tasks_user_idx on public.tasks (user_name);
create index if not exists tasks_on_today_idx on public.tasks (on_today) where on_today = true;

-- ---------- RLS ----------
alter table public.categories enable row level security;
alter table public.tasks      enable row level security;

-- Allow anon/publishable key full access to these two tables only.
-- (No other tables are exposed; this is scoped, not a global bypass.)
drop policy if exists "categories_all_anon" on public.categories;
create policy "categories_all_anon"
  on public.categories
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "tasks_all_anon" on public.tasks;
create policy "tasks_all_anon"
  on public.tasks
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Next: run auth-schema.sql (same folder) for email login, profiles, and RLS.
