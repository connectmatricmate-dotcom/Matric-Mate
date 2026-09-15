-- The evening nudge had been silent since the 14:00 message started.
--
-- "Already nudged tonight" was worked out from the inbox: any reminder or
-- streak notice in the last 18 hours. The daily 14:00 tip is a reminder too,
-- written two to seven hours before every nudge run, so from 14 Sep every
-- student who got the tip counted as nudged and the job answered
-- {"considered":0,"sent":0} every evening, which reads exactly like "nobody
-- due". Found in the 15 Sep audit: the dry run would have sent 23.
--
-- The nudge now keeps its own record, the way the tip does with tip_sent_on:
-- the day it last reached this student, claimed just before sending and given
-- back if the message did not go.

alter table public.profiles add column if not exists nudged_on date;

comment on column public.profiles.nudged_on is
  'Karachi day the evening nudge last reached this student. Claimed by /api/cron/nudge right before it sends; not writable from the apps.';
