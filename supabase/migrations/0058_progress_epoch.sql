-- "Reset app data" did not reach the student's other devices.
--
-- A reset (and a class or board switch, which runs the same wipe) deletes the
-- study history on the server. Every other device still held its own copy,
-- and the hydrate there merges rather than replaces: answers, sections read
-- and study days are a union, so the phone put the old history straight back
-- on screen, and in time back on the server with its next write.
--
-- So the account now records when its history was last wiped. A device keeps
-- the value it last saw beside its copy; when the account's is newer, the
-- copy predates the wipe and is thrown away instead of merged (sync.ts,
-- mergeHydratedState). Written only through the function below, with the
-- server's clock, so no device's clock decides which side of a reset it is on.

alter table public.profiles add column if not exists progress_reset_at timestamptz;

comment on column public.profiles.progress_reset_at is
  'When this account''s study history was last wiped (reset or class/board switch). Devices holding an older copy discard it.';

create or replace function public.mark_progress_reset()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  stamp timestamptz := now();
begin
  if uid is null then
    raise exception 'mark_progress_reset: not authenticated';
  end if;
  update public.profiles set progress_reset_at = stamp where id = uid;
  return stamp;
end;
$$;

comment on function public.mark_progress_reset() is
  'Stamp the caller''s study history as wiped now. Called by both apps right after wipeStudyHistory.';

revoke all on function public.mark_progress_reset() from public, anon;
grant execute on function public.mark_progress_reset() to authenticated;
