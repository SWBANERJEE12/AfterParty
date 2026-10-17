-- One-shot repair for partial 008 / missing 009 / missing 010 (Supabase SQL Editor).
-- Safe to run on a database where 008 partially applied (e.g. policy already exists errors).
-- Does not drop tables or user data. Reconciles policies to the intended definitions.
--
-- Order: profiles (008) → friends (009) → library (010).
-- After running: Dashboard → Settings → API → "Reload schema" if PostgREST still shows stale cache.

-- =============================================================================
-- 008 — profiles + auth trigger
-- =============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  preferences jsonb not null default '{}'::jsonb,
  constraint profiles_username_format check (username ~ '^[a-zA-Z0-9_]{3,20}$'),
  constraint profiles_display_name_len check (char_length(display_name) between 1 and 32),
  constraint profiles_username_unique unique (username)
);

create index if not exists profiles_username_lower_idx on public.profiles (lower(username));

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text;
  v_display text;
begin
  v_username := trim(coalesce(new.raw_user_meta_data ->> 'username', ''));
  v_display := trim(coalesce(new.raw_user_meta_data ->> 'display_name', v_username));

  if v_username = '' or v_username !~ '^[a-zA-Z0-9_]{3,20}$' then
    raise exception 'invalid username metadata';
  end if;

  if char_length(v_display) < 1 or char_length(v_display) > 32 then
    v_display := v_username;
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, v_username, v_display);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- =============================================================================
-- 009 — friends (requires profiles)
-- =============================================================================
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles (id) on delete cascade,
  to_user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint friend_requests_no_self check (from_user_id <> to_user_id),
  constraint friend_requests_unique_pair unique (from_user_id, to_user_id)
);

create table if not exists public.friendships (
  user_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  constraint friendships_no_self check (user_id <> friend_id)
);

create index if not exists friend_requests_to_user_idx on public.friend_requests (to_user_id, status);

alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;

drop policy if exists "friend_requests_select_involved" on public.friend_requests;
create policy "friend_requests_select_involved"
  on public.friend_requests for select
  to authenticated
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

drop policy if exists "friend_requests_insert_from_self" on public.friend_requests;
create policy "friend_requests_insert_from_self"
  on public.friend_requests for insert
  to authenticated
  with check (auth.uid() = from_user_id and from_user_id <> to_user_id);

drop policy if exists "friend_requests_update_to_user" on public.friend_requests;
create policy "friend_requests_update_to_user"
  on public.friend_requests for update
  to authenticated
  using (auth.uid() = to_user_id or auth.uid() = from_user_id)
  with check (auth.uid() = to_user_id or auth.uid() = from_user_id);

drop policy if exists "friendships_select_own" on public.friendships;
create policy "friendships_select_own"
  on public.friendships for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "friendships_insert_own" on public.friendships;
create policy "friendships_insert_own"
  on public.friendships for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "friendships_delete_own" on public.friendships;
create policy "friendships_delete_own"
  on public.friendships for delete
  to authenticated
  using (auth.uid() = user_id);

-- =============================================================================
-- 010 — my list + watch history (requires profiles)
-- =============================================================================
create table if not exists public.my_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  imdb_id text not null,
  title text not null,
  poster_url text,
  release_year text,
  added_at timestamptz not null default now(),
  constraint my_list_unique_title unique (user_id, imdb_id)
);

create table if not exists public.watch_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  imdb_id text not null,
  title text not null,
  poster_url text,
  progress_seconds numeric not null default 0 check (progress_seconds >= 0),
  duration_seconds numeric,
  last_watched_at timestamptz not null default now(),
  constraint watch_history_unique_title unique (user_id, imdb_id)
);

create index if not exists watch_history_user_last_idx on public.watch_history (user_id, last_watched_at desc);

alter table public.my_list_items enable row level security;
alter table public.watch_history enable row level security;

drop policy if exists "my_list_select_own" on public.my_list_items;
create policy "my_list_select_own"
  on public.my_list_items for select to authenticated using (auth.uid() = user_id);

drop policy if exists "my_list_insert_own" on public.my_list_items;
create policy "my_list_insert_own"
  on public.my_list_items for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "my_list_delete_own" on public.my_list_items;
create policy "my_list_delete_own"
  on public.my_list_items for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "history_select_own" on public.watch_history;
create policy "history_select_own"
  on public.watch_history for select to authenticated using (auth.uid() = user_id);

drop policy if exists "history_insert_own" on public.watch_history;
create policy "history_insert_own"
  on public.watch_history for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "history_update_own" on public.watch_history;
create policy "history_update_own"
  on public.watch_history for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "history_delete_own" on public.watch_history;
create policy "history_delete_own"
  on public.watch_history for delete to authenticated using (auth.uid() = user_id);

-- Optional: notify PostgREST to refresh (no-op if unsupported)
notify pgrst, 'reload schema';
