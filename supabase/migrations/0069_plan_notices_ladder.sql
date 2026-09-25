-- Every day of a trial, and a month after an ending, has its message now.
--
-- plan_notices records which plan reminder has gone to whom, one row per
-- (student, kind, plan end date), so the hourly plans job sends each once.
-- It knew four kinds. The job now also sends:
--
--   trial_day2      two days left of a three-day trial
--   plan_last_day   a paid plan's last day
--   lapsed_3 .. 30  still no plan 3, 7, 14 and 30 days after one ended
--
-- A kind the check does not list fails the claim, and a claim that fails is
-- retried every hour without ever sending, so this has to be in place before
-- the job that uses it.

alter table public.plan_notices drop constraint if exists plan_notices_kind_check;
alter table public.plan_notices add constraint plan_notices_kind_check check (
  kind in (
    'trial_day2', 'trial_ending', 'trial_ended',
    'plan_ending', 'plan_last_day', 'plan_ended',
    'lapsed_3', 'lapsed_7', 'lapsed_14', 'lapsed_30'
  )
);
