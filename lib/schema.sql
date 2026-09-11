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

-- ── Parent PIN (added July 2026) ─────────────────────────────────────────────
-- Optional 4-digit gate for parent pages, stored as SHA-256(userId:pin).
-- A child gate, not account security — managed from Settings in the app.
alter table profiles add column if not exists parent_pin_hash text;

-- ═════════════════════════════════════════════════════════════════════════════
-- Durable rate limiting  (added September 2026 — run this BEFORE deploying the
-- updated /api/gemini-key route)
--
-- /api/gemini-key mints Gemini Live tokens for anonymous demo visitors, so its
-- rate limiter is a billing control, not just a politeness measure. The old
-- in-memory Map was per-serverless-instance and therefore effectively no limit
-- under real traffic. This table moves the counter into Postgres, where every
-- instance shares it.
--
-- Service role only: the route reads/writes it through serviceClient().
-- ═════════════════════════════════════════════════════════════════════════════
create table if not exists rate_limits (
  id       text primary key,       -- e.g. 'user:<uuid>' or 'ip:1.2.3.4'
  count    int not null default 0,
  reset_at timestamptz not null    -- when the current window expires
);
alter table rate_limits enable row level security;

-- No policies are defined, so RLS denies anon and authenticated outright.
-- The service role bypasses RLS; these revokes make the intent explicit and
-- also cover the PostgREST grants Supabase hands out by default.
revoke all on table rate_limits from anon, authenticated;

-- Supports the cleanup sweep below.
create index if not exists rate_limits_reset_at_idx on rate_limits (reset_at);

-- Atomically count one hit against a limiter and report whether the caller has
-- gone over. Returns true = over the limit (reject), false = allowed.
--
-- The counting is ONE statement on purpose. "insert .. on conflict do update"
-- takes a row lock, so concurrent requests for the same id queue up and each
-- sees the previous one's increment. A read-then-write pair would let two
-- simultaneous requests both read a stale count and both be allowed through.
--
-- An expired window is reset in the same statement rather than deleted first,
-- so there is no gap where a second caller could slip in on a fresh row.
create or replace function public.check_rate_limit(
  p_id             text,
  p_limit          int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  -- Cheap opportunistic cleanup: roughly one call in 100 sweeps rows whose
  -- window closed over an hour ago. Keeps the table small with no cron job
  -- and no measurable cost on the other 99 calls.
  if random() < 0.01 then
    delete from rate_limits where reset_at < now() - interval '1 hour';
  end if;

  insert into rate_limits as r (id, count, reset_at)
  values (p_id, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (id) do update
    set count = case when r.reset_at <= now() then 1 else r.count + 1 end,
        reset_at = case
          when r.reset_at <= now() then now() + make_interval(secs => p_window_seconds)
          else r.reset_at
        end
  returning r.count into v_count;

  return v_count > p_limit;
end;
$$;

-- security definer means the function runs as its owner, so lock it down to
-- the service role — a browser-side client must never be able to call it.
revoke all on function public.check_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, int, int) to service_role;
