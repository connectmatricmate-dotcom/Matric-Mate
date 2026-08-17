-- The inbox, connected and live.
--
-- Both apps have always shipped a notifications screen, and the payment webhook
-- has always inserted rows into the table that screen is named after. The two
-- were never joined up: the stores initialised `notifications` to an empty
-- array and nothing ever read the table, so five real receipts sat in the
-- database while both apps told the student their inbox was empty.
--
-- Hydration now reads it (see fetchStudyState). This adds the live half, so a
-- receipt written by the Safepay webhook lands while the student is still
-- looking at the confirmation, rather than at the next cold start.
--
-- Same function, same per-student topic and same signal-only payload as 0016
-- and 0018: the subscriber re-reads through its own authenticated session, so
-- the topic never carries the notification's contents.

drop trigger if exists notifications_broadcast on public.notifications;

create trigger notifications_broadcast
  after insert or update or delete on public.notifications
  for each row
  execute function public.broadcast_study_change();
