-- Run this in Supabase SQL Editor

-- Profiles (parents)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "Users manage own profile" on profiles
  for all using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

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
create policy "Parents manage word progress" on progress
  for all using (
    exists (
      select 1 from children
      where children.id = progress.child_id
      and children.parent_id = auth.uid()
    )
  );
