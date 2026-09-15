-- The morning coach report (and its "your report is ready" push) went out at
-- 06:30 in Karachi, with a retry at 07:30. Moved an hour later, to 07:30 and
-- 08:30: still before most school days get going, no longer at dawn. The
-- plans job keeps its own quiet hours (21:00 to 08:00); the welcome follows a
-- student's own sign-up within fifteen minutes, so it comes when they are up.

select cron.alter_job((select jobid from cron.job where jobname = 'matricmate-coach'), schedule => '30 2 * * *');
select cron.alter_job((select jobid from cron.job where jobname = 'matricmate-coach-retry'), schedule => '30 3 * * *');
