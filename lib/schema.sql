-- Run this in Supabase SQL Editor.
-- The whole file is idempotent — safe to re-run on an existing project
-- (each policy is dropped before being recreated).

-- Profiles (parents)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  created_at timestamptz default now()
);
alter table profiles enable row level security;
drop policy if exists "Users manage own profile" on profiles;
create policy "Users manage own profile" on profiles
  for all using (auth.uid() = id);

-- Auto-create profile on signup.
-- MUST be schema-qualified with a pinned search_path: the auth service runs
-- this trigger with a search path that does not include "public", so a bare
-- "profiles" reference makes every signup fail with
-- "Database error saving new user".
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Children
create table if not exists children (
  id uuid default gen_random_uuid() primary key,
  parent_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  age int,
  avatar text default '🌟',
  primary_language text default 'sw',
  xp int default 0,
  streak int default 0,
  last_session_at timestamptz,
  created_at timestamptz default now()
);
alter table children enable row level security;
drop policy if exists "Parents manage own children" on children;
create policy "Parents manage own children" on children
  for all using (auth.uid() = parent_id);

-- Sessions
create table if not exists sessions (
  id uuid default gen_random_uuid() primary key,
  child_id uuid references children(id) on delete cascade not null,
  game text not null,
  language text not null,
  duration_seconds int default 0,
  xp_earned int default 0,
  words_practiced text[] default '{}',
  transcript jsonb default '[]',
  created_at timestamptz default now()
);
alter table sessions enable row level security;
drop policy if exists "Parents view own children sessions" on sessions;
create policy "Parents view own children sessions" on sessions
  for all using (
    exists (
      select 1 from children
      where children.id = sessions.child_id
      and children.parent_id = auth.uid()
    )
  );

-- Word progress (for spaced repetition later)
create table if not exists progress (
  id uuid default gen_random_uuid() primary key,
  child_id uuid references children(id) on delete cascade not null,
  word text not null,
  language text not null,
  correct_count int default 0,
  attempt_count int default 0,
  last_seen_at timestamptz default now(),
  unique(child_id, word, language)
);
alter table progress enable row level security;
drop policy if exists "Parents manage word progress" on progress;
create policy "Parents manage word progress" on progress
  for all using (
    exists (
      select 1 from children
      where children.id = progress.child_id
      and children.parent_id = auth.uid()
    )
  );

-- ═════════════════════════════════════════════════════════════════════════════
-- Server-authoritative XP  (added July 2026 — run this AFTER deploying the
-- /api/complete-session and /api/quiz-results routes)
--
-- XP, streaks, session rows, and word progress are now written ONLY by the
-- server (service role), which verifies child ownership and clamps values —
-- so scores cannot be forged from the browser with dev tools.
-- Parents keep: read access everywhere, add/remove children, and editing a
-- child's profile fields (name, age, avatar, language).
-- ═════════════════════════════════════════════════════════════════════════════
revoke update on table children from authenticated;
grant update (name, age, avatar, primary_language) on table children to authenticated;
revoke insert, update, delete on table sessions from authenticated;
revoke insert, update, delete on table progress from authenticated;
