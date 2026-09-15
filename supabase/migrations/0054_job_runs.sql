-- What each scheduled job did, kept for a month.
--
-- pg_cron records every run as succeeded whatever the route answers, and the
-- routes' answers (pg_net's responses) are deleted after six hours. The
-- evening nudge sent nothing for days and nothing anywhere said so: its answer
-- read {"considered":0} and was gone by morning. Each job route now writes one
-- row per run (lib/notify/jobs.ts, logged()), and the admin overview shows the
-- latest of each.

create table if not exists public.job_runs (
  id bigserial primary key,
  job text not null,
  at timestamptz not null default now(),
  status integer not null,
  summary jsonb
);
create index if not exists job_runs_job_at_idx on public.job_runs (job, at desc);
alter table public.job_runs enable row level security;
-- No policies: written and read with the server key only.

select cron.schedule('matricmate-job-runs-trim', '15 22 * * *', $$delete from public.job_runs where at < now() - interval '30 days'$$);
