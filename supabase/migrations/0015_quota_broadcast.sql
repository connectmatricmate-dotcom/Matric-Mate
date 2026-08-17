-- The AI quota, live.
--
-- The number of questions left today was drifting between screens. The header
-- read a counter the client kept itself, one per action, while the tutor page
-- read the server's. The server does not charge one per action (a mock paper
-- costs three, a generated set two), so one paper left the two readings two
-- apart. The local counter was per device as well, so a phone and a laptop
-- disagreed for the same student on the same day.
--
-- The client counter is gone. Every screen now reads the server's count, and
-- this broadcast is what keeps that reading current without polling: any write
-- to ai_usage tells the student's own devices to update.
--
-- Broadcast, not postgres_changes, per docs/engineering/Supabase Realtime
-- Guide.md: postgres_changes has a history of subscribing successfully and
-- then delivering nothing.

create or replace function public.broadcast_ai_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send(
    -- Minimal payload. The topic is public, so it carries no more than a
    -- count: the limit is a constant the client already knows, and the
    -- remaining figure is arithmetic it can do itself.
    jsonb_build_object(
      'used', new.used,
      'day',  new.day
    ),
    'change',
    'quota:' || new.user_id::text,
    false  -- private := false, matching config: { private: false } on the client
  );
  return new;
end;
$$;

drop trigger if exists ai_usage_broadcast on public.ai_usage;

create trigger ai_usage_broadcast
  after insert or update on public.ai_usage
  for each row
  execute function public.broadcast_ai_usage();

-- No grants. The function is security definer and fires as the table owner
-- regardless of who writes the row; granting execute would only expose it as a
-- callable RPC, which the security advisors flag. See the guide's Don'ts.
