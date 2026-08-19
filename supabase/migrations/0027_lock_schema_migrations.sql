-- The migration ledger was writable by anyone holding the publishable key.
--
-- Supabase sent a risk notice for this on 19 Aug. Every other table in the
-- schema has row level security on and a policy behind it; `schema_migrations`
-- had neither, because it is not application data and was created by our own
-- tooling (`scripts/db-migrate.mjs`) rather than by a migration. It still sits
-- in the `public` schema, and Supabase grants `anon` and `authenticated` full
-- privileges on everything there by default, so RLS is the only thing standing
-- between a table and the internet. With RLS off, there was nothing.
--
-- Verified against production before writing this, using the publishable key
-- that ships inside every APK:
--
--   SELECT  200, the whole migration history
--   INSERT  201, wrote a row
--   DELETE  204, removed it again
--
-- Reading it is an information leak and the smaller half. Deleting from it is
-- the real damage: `db-migrate.mjs` decides what to run by asking this table
-- what has already run, so emptying it makes the next deploy replay all 26
-- migrations from 0001, drops and backfills included.
--
-- Two locks, because one of them is a default that a future `grant` could
-- undo without anybody noticing.

-- 1. Row level security with no policy at all. Not an oversight: a policy is
--    permission to do something, and no role that reaches this table through
--    PostgREST should be able to do anything. The `postgres` role that
--    db-migrate.mjs connects as has BYPASSRLS, so the tooling is unaffected.
alter table public.schema_migrations enable row level security;

-- 2. And take the grants away, so the table is unreachable even if a policy
--    is ever added to it by mistake.
revoke all on public.schema_migrations from anon, authenticated;

comment on table public.schema_migrations is
  'Which migrations have run. Written only by scripts/db-migrate.mjs over a direct connection. Not reachable from PostgREST: RLS is on with no policies and the anon and authenticated grants are revoked. Do not add a policy here.';
