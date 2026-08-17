-- Finished tests belong in the live set too.
--
-- 0016 wired the five tables the home screen reads: active_days, attempts,
-- plan_done, read_sections and cards_known. It missed `results`, which is what
-- the practice tab's "recent sessions" list and the progress screen's test
-- history are built from. So finishing a timed test on a phone left the
-- laptop's list a test short until it happened to hydrate again.
--
-- Same function, same per-student topic, same signal-only payload.

drop trigger if exists results_broadcast on public.results;

create trigger results_broadcast
  after insert or update or delete on public.results
  for each row
  execute function public.broadcast_study_change();
