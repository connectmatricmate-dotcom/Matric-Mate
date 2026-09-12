-- Three fixes the web app's server needs from the database.
--
--   1. The daily AI allowance is charged in one statement, so two requests in
--      flight can no longer both write back the same count.
--   2. Students can read their allowance but no longer write it.
--   3. Each scheduled job gets a second run, and the jobs are given long
--      enough to answer that a failure is recorded.
--
-- The code works with or without this migration: until charge_ai_usage
-- exists, lib/ai/guard.ts falls back to reading the count and writing it
-- straight back, which is the old race in a much narrower window.

-- ─────────────────────────────────────────────────── 1. charge_ai_usage

-- Every AI route read `used` when the request arrived and wrote `used + cost`
-- when it finished. Two requests at once both wrote the same number, and a
-- mock paper that took four minutes wrote back a count from before anything
-- else the student did in those four minutes. Both handed quota back.
--
-- An upsert that adds to whatever is there, returning the new total. Only the
-- server calls it, with the service role, after an answer has been delivered.
create or replace function public.charge_ai_usage(p_user uuid, p_day date, p_cost integer)
returns integer
language sql
set search_path = ''
as $$
  insert into public.ai_usage as u (user_id, day, used)
  values (p_user, p_day, greatest(p_cost, 0))
  on conflict (user_id, day) do update set used = u.used + excluded.used
  returning u.used;
$$;

revoke all on function public.charge_ai_usage(uuid, date, integer) from public, anon, authenticated;
grant execute on function public.charge_ai_usage(uuid, date, integer) to service_role;

comment on function public.charge_ai_usage(uuid, date, integer) is
  'Adds p_cost to a student''s AI usage for p_day in one statement and returns the new total. Service role only.';

-- ────────────────────────────────────────── 2. ai_usage is read-only to students

-- 0001 gave ai_usage the same "own rows" policy as the study tables, for all
-- commands. That let any student set their own count back to zero from the
-- browser with their own session, and have a fresh 50 questions whenever they
-- liked. Nothing in either app writes this table; only the server does, with
-- the service role, which RLS does not apply to. The apps still read it for
-- the counter, and the realtime broadcast from 0015 fires on the server's
-- writes as before.
drop policy if exists "own rows" on public.ai_usage;
drop policy if exists "read own usage" on public.ai_usage;
create policy "read own usage" on public.ai_usage
  for select using ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────── 3. the scheduled jobs

-- pg_net records whatever a job answers, but only while it is still waiting:
-- 0024 gave it two minutes, and the coach job can take longer than that when
-- it has a full night of reports to write. Past the wait, the answer is lost
-- and the run looks like a timeout whether or not it worked. Five minutes
-- matches the routes' own limit (maxDuration = 300), so every run's real
-- status lands in net._http_response. Otherwise unchanged from 0024.
create or replace function jobs.call_endpoint(path text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  base   text;
  secret text;
begin
  select decrypted_secret into base   from vault.decrypted_secrets where name = 'site_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cron_secret';

  if base is null or secret is null then
    raise warning 'jobs.call_endpoint(%): site_url or cron_secret missing from vault', path;
    return null;
  end if;

  -- Fire and forget. pg_net queues the request and returns an id; the job is
  -- done once it is queued, so a slow endpoint cannot hold a database worker.
  return net.http_get(
    url := base || path,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret),
    timeout_milliseconds := 300000
  );
end;
$$;

revoke all on function jobs.call_endpoint(text) from public, anon, authenticated;

-- A second run of each job. pg_cron only queues the call, so a run that met a
-- database gateway timeout was simply lost: on 12 September, 16 of 26 calls
-- ended that way, the 4pm nudge among them. The routes now retry their own
-- reads and answer non-200 when they could not finish, and these entries run
-- them again shortly after. Both are safe to run twice: the nudge skips anyone
-- already nudged in the last 18 hours, and the coach skips anyone whose report
-- is less than 20 hours old, so the second run only reaches whoever the first
-- one missed.
do $$
declare j record;
begin
  for j in select jobid from cron.job where jobname in ('matricmate-nudge-retry', 'matricmate-coach-retry')
  loop
    perform cron.unschedule(j.jobid);
  end loop;
end $$;

-- Five past each nudge hour (16:05 to 21:05 in Karachi). Still the same hour,
-- so it reaches the same students the :00 run was for.
select cron.schedule('matricmate-nudge-retry', '5 11-16 * * *', $$select jobs.call_endpoint('/api/cron/nudge')$$);

-- An hour after the coach run: 02:30 UTC is 07:30 in Karachi.
select cron.schedule('matricmate-coach-retry', '30 2 * * *', $$select jobs.call_endpoint('/api/cron/coach')$$);
