-- TASKMASTER — Auth, profiles, category access, and RLS
-- Run in Supabase SQL Editor AFTER `supabase-schema.sql` (or merge into one migration).
--
-- Dashboard setup (required):
--   1. Authentication → Providers → Email: enable; turn OFF "Allow new users to sign up"
--      (invites / dashboard-created users still work).
--   2. Create your first user: Authentication → Users → Add user (or Invite).
--   3. Promote to admin:
--        update public.profiles set role = 'admin' where email = 'you@example.com';
--   4. Deploy Edge Function `invite-user` so admins can invite from the app (see supabase/functions).

create extension if not exists "pgcrypto";

-- ---------- profiles (1:1 with auth.users) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'member' check (role in ('admin', 'member')),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

-- ---------- category access for members ----------
create table if not exists public.user_category_access (
  user_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (user_id, category_id)
);

create index if not exists user_category_access_user_idx on public.user_category_access (user_id);

-- ---------- sync profile on signup / invite ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      split_part(new.email, '@', 1)
    ),
    'member'
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    updated_at = now();
  -- role is not updated on conflict so promoted admins stay admin
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- helpers (bypass RLS) ----------
create or replace function public.is_admin(check_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = check_uid and p.role = 'admin'
  );
$$;

-- ---------- RLS: replace open policies on categories / tasks ----------
drop policy if exists "categories_all_anon" on public.categories;
drop policy if exists "tasks_all_anon" on public.tasks;

alter table public.profiles enable row level security;
alter table public.user_category_access enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id or public.is_admin(auth.uid()));

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update"
  on public.profiles for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "uca_select" on public.user_category_access;
create policy "uca_select"
  on public.user_category_access for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "uca_write" on public.user_category_access;
create policy "uca_write"
  on public.user_category_access for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

drop policy if exists "uca_update" on public.user_category_access;
create policy "uca_update"
  on public.user_category_access for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "uca_delete" on public.user_category_access;
create policy "uca_delete"
  on public.user_category_access for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- categories
drop policy if exists "categories_select" on public.categories;
create policy "categories_select"
  on public.categories for select
  to authenticated
  using (
    public.is_admin(auth.uid())
    or exists (
      select 1 from public.user_category_access u
      where u.user_id = auth.uid() and u.category_id = categories.id
    )
  );

drop policy if exists "categories_insert" on public.categories;
create policy "categories_insert"
  on public.categories for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

drop policy if exists "categories_update" on public.categories;
create policy "categories_update"
  on public.categories for update
  to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists "categories_delete" on public.categories;
create policy "categories_delete"
  on public.categories for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- tasks
drop policy if exists "tasks_select" on public.tasks;
create policy "tasks_select"
  on public.tasks for select
  to authenticated
  using (
    public.is_admin(auth.uid())
    or exists (
      select 1 from public.user_category_access u
      where u.user_id = auth.uid() and u.category_id = tasks.category_id
    )
  );

drop policy if exists "tasks_insert" on public.tasks;
create policy "tasks_insert"
  on public.tasks for insert
  to authenticated
  with check (
    public.is_admin(auth.uid())
    or exists (
      select 1 from public.user_category_access u
      where u.user_id = auth.uid() and u.category_id = tasks.category_id
    )
  );

drop policy if exists "tasks_update" on public.tasks;
create policy "tasks_update"
  on public.tasks for update
  to authenticated
  using (
    public.is_admin(auth.uid())
    or exists (
      select 1 from public.user_category_access u
      where u.user_id = auth.uid() and u.category_id = tasks.category_id
    )
  )
  with check (
    public.is_admin(auth.uid())
    or exists (
      select 1 from public.user_category_access u
      where u.user_id = auth.uid() and u.category_id = tasks.category_id
    )
  );

drop policy if exists "tasks_delete" on public.tasks;
create policy "tasks_delete"
  on public.tasks for delete
  to authenticated
  using (
    public.is_admin(auth.uid())
    or exists (
      select 1 from public.user_category_access u
      where u.user_id = auth.uid() and u.category_id = tasks.category_id
    )
  );

-- ---------- task creator (OneSignal admin alerts) ----------
-- Webhook + Edge Function use created_by to detect member inserts.
alter table public.tasks
  add column if not exists created_by uuid references auth.users (id) on delete set null;

create or replace function public.tasks_lock_created_by()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  elsif tg_op = 'UPDATE' then
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_lock_created_by_trg on public.tasks;
create trigger tasks_lock_created_by_trg
  before insert or update on public.tasks
  for each row
  execute function public.tasks_lock_created_by();
