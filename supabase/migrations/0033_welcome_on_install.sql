-- Welcome a student once, when they first put the app on a phone.
--
-- "Installed the app" is not an event this system can see. There is no install
-- hook; the closest true signal is a device registering a push token, which is
-- what happens the first time the app is opened and signed into. So a small
-- job sweeps for accounts that have a device and have never been welcomed.
--
-- The column is what makes it once. Checking the notifications table for a row
-- with the right title would break the first time the wording changed, and
-- would greet somebody a second time after they cleared their inbox.

alter table public.profiles
  add column if not exists welcomed_at timestamptz;

comment on column public.profiles.welcomed_at is
  'When the welcome notification was sent. Null means never. Written only by the welcome job.';

-- Students who already have the app keep their welcome: the three devices
-- registered before this job existed were sent one by hand, and marking them
-- stops the sweep greeting them twice.
update public.profiles p
set welcomed_at = now()
where p.welcomed_at is null
  and exists (select 1 from public.notifications n where n.user_id = p.id and n.title like 'Welcome to MatricMate%');

-- Every quarter of an hour. A welcome that lands an hour after somebody first
-- opens the app has missed the moment it was for; fifteen minutes still reads
-- as the app noticing them.
select cron.schedule(
  'matricmate-welcome',
  '*/15 * * * *',
  $$select jobs.call_endpoint('/api/cron/welcome')$$
);
