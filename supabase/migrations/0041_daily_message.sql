-- The afternoon message: a flashcard or an exam tip from the student's own
-- syllabus, once a day, at 14:00 in Karachi. See apps/web/app/api/cron/daily.

-- ─────────────────────────────────────────────── 1. once a day, each

-- The day the student was last sent it, in Karachi. The job stamps this
-- BEFORE it sends, in one update that only returns rows not already stamped
-- today, so a retried or double-fired run cannot send the same day twice.
alter table public.profiles add column if not exists tip_sent_on date;

comment on column public.profiles.tip_sent_on is
  'Karachi date of the last afternoon message (tip or flashcard). Written by /api/cron/daily before sending.';

-- ─────────────────────────────────────────────── 2. the schedule

do $$
declare j record;
begin
  for j in select jobid from cron.job where jobname in ('matricmate-daily', 'matricmate-daily-retry')
  loop
    perform cron.unschedule(j.jobid);
  end loop;
end $$;

-- 09:00 UTC is 14:00 in Karachi: after school, before the earliest evening nudge at 16:00.
select cron.schedule('matricmate-daily', '0 9 * * *', $$select jobs.call_endpoint('/api/cron/daily')$$);

-- Five minutes later, for anyone the first run could not claim. Safe: the
-- claim above means it only ever reaches students not yet sent today.
select cron.schedule('matricmate-daily-retry', '5 9 * * *', $$select jobs.call_endpoint('/api/cron/daily')$$);
