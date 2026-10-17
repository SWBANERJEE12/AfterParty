# Audit: migrations 008, 009, 010

Apply order: **008 → 009 → 010**. Migration **009** and **010** both require `public.profiles` from **008**. **009** and **010** do not depend on each other.

Supabase SQL Editor runs statements in a single transaction only when you use an explicit `BEGIN`/`COMMIT` block. A failed `CREATE POLICY` after earlier statements succeeded often means **objects from the same script already exist** on a retry—not a full rollback of the whole file.

---

## 008 — `008_profiles_auth.sql`

| Object | Type | Purpose |
|--------|------|---------|
| `public.profiles` | table | One row per `auth.users` id; username, display_name, avatar, preferences |
| `profiles_username_lower_idx` | index | Case-insensitive username search |
| RLS on `profiles` | enabled | All access via policies |
| `profiles_select_authenticated` | policy | `authenticated` may **select** any profile (`using (true)`) — needed for Friends username search |
| `profiles_update_own` | policy | `authenticated` may **update** only `auth.uid() = id` |
| `handle_new_user()` | function | `SECURITY DEFINER` insert into `profiles` from signup metadata |
| `on_auth_user_created` | trigger on `auth.users` | Runs `handle_new_user` after insert |

**No** direct `INSERT` policy on `profiles` for clients; rows are created by the trigger.

### Typical partial-apply state (your error)

`ERROR: policy "profiles_select_authenticated" already exists` means at least:

- `public.profiles` table likely exists
- RLS likely enabled
- Policy `profiles_select_authenticated` already exists with the intended definition (from a prior run)

Later objects may or may not exist: `profiles_update_own`, `handle_new_user`, trigger.

### Repair approach

`DROP POLICY IF EXISTS` then `CREATE POLICY` with the **same** expressions as above. `CREATE OR REPLACE` for the function; `DROP TRIGGER IF EXISTS` then recreate trigger. Tables/indexes use `IF NOT EXISTS`.

---

## 009 — `009_friends.sql`

| Object | Type | Purpose |
|--------|------|---------|
| `public.friend_requests` | table | Outgoing requests; FK → `profiles` |
| `public.friendships` | table | Accepted pairs; FK → `profiles` |
| `friend_requests_to_user_idx` | index | Inbox lookups by `to_user_id`, `status` |
| RLS | enabled | Both tables |
| `friend_requests_select_involved` | policy | Select if sender or recipient |
| `friend_requests_insert_from_self` | policy | Insert as sender only |
| `friend_requests_update_to_user` | policy | Update if involved |
| `friendships_select_own` | policy | Select rows where `user_id = auth.uid()` |
| `friendships_insert_own` | policy | Insert own side of friendship |
| `friendships_delete_own` | policy | Delete own friendship rows |

Depends on **008** only (`profiles.id`).

### Partial-apply risks

Same as 008: duplicate policy names on re-run. Tables may exist without all policies.

---

## 010 — `010_library.sql`

| Object | Type | Purpose |
|--------|------|---------|
| `public.my_list_items` | table | Saved titles; FK → `profiles` |
| `public.watch_history` | table | Playback progress; FK → `profiles` |
| `watch_history_user_last_idx` | index | Recent history per user |
| RLS | enabled | Both tables |
| `my_list_*` policies | policies | Select/insert/delete own rows only |
| `history_*` policies | policies | Select/insert/update/delete own rows only |

Depends on **008** only. Does **not** require 009.

---

## Recovery for your database (recommended)

**Option A — one file (fastest):** In Supabase → SQL Editor, run the entire:

`supabase/migrations/020_repair_profiles_friends_library.sql`

**Option B — stepwise:** Re-run the updated files in order:

1. `008_profiles_auth.sql` (now idempotent)
2. `009_friends.sql`
3. `010_library.sql`

Then:

- `npm run check:supabase` locally (probes `profiles`, `friend_requests`, `my_list_items`)
- If the app still says “schema cache”, use Dashboard → **Project Settings → API → Reload schema** (or wait a few minutes)

---

## Verify objects (SQL Editor)

```sql
select tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'friend_requests', 'friendships', 'my_list_items', 'watch_history')
order by tablename, policyname;

select tgname from pg_trigger
where tgname = 'on_auth_user_created';
```

Expected policy counts: profiles **2**, friend_requests **3**, friendships **3**, my_list_items **3**, watch_history **4**.
