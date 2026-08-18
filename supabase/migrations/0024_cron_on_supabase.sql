-- The scheduled jobs move here, off Vercel.
--
-- The nudge became hourly across the evening so that each student is reminded
-- at the time they actually chose. Vercel's Hobby plan allows one cron run per
-- day and rejects anything more, which failed the build rather than degrading:
-- no deployment at all, for any change, until the schedule was removed.
--
-- Supabase is on a paid plan and has pg_cron, so the clock lives here. Nothing
-- about the jobs themselves changes: they are still ordinary HTTP endpoints on
-- the web app, still behind CRON_SECRET, still doing the work in TypeScript
-- where the notice copy and the picker logic already are. Postgres only calls
-- them on a schedule.
--
-- Times are UTC, as the database is. 11:00 to 16:00 UTC is 16:00 to 21:00 in
-- Karachi, which is the range the reminder picker offers.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create schema if not exists jobs;
comment on schema jobs is 'Scheduled work. See cron.job for the schedule itself.';

/*
 * The secret is NOT in this file, because this file is in git.
 *
 * Both values are read from Vault at call time, seeded by
 * scripts/db-cron-secrets.mjs out of apps/web/.env.local. A missing secret
 * warns and returns null rather than posting an unauthenticated request that
 * the route would answer with 401 and nobody would ever read.
 */
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
    timeout_milliseconds := 120000
  );
end;
$$;

revoke all on function jobs.call_endpoint(text) from public, anon, authenticated;

-- Re-running this migration must not stack duplicate schedules.
do $$
declare j record;
begin
  for j in select jobid from cron.job where jobname in ('matricmate-nudge', 'matricmate-coach')
  loop
    perform cron.unschedule(j.jobid);
  end loop;
end $$;

-- Hourly through the Karachi evening; each run writes only to the students who
-- chose that hour. See apps/web/app/api/cron/nudge/route.ts.
select cron.schedule('matricmate-nudge', '0 11-16 * * *', $$select jobs.call_endpoint('/api/cron/nudge')$$);

-- Once, overnight. 01:30 UTC is 06:30 in Karachi.
select cron.schedule('matricmate-coach', '30 1 * * *', $$select jobs.call_endpoint('/api/cron/coach')$$);
