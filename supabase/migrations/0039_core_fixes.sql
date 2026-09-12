-- A student's whole XP, summed where the whole history is.
--
-- Both apps recompute XP from the attempts they hold after every sync. They
-- hold at most a thousand: the hydrate reads the newest thousand and the phone
-- keeps a thousand. Past that a student's XP stalled, and then fell, as old
-- answers rolled out of the window. The server has every answer, so it adds
-- them up, and core adds what the device has queued and not yet sent (see
-- hydratedXp in packages/core/src/sync.ts). Until this exists the call fails
-- and core falls back to recomputing, exactly as before.
--
-- The rule is packages/core/src/domain.ts, xpForAttempt and XP: a right answer
-- is 12 when sure, 10 when fairly sure or when no confidence was asked, 5 for
-- a lucky guess, doubled in an exam; a wrong one is nothing. Each known card is
-- 2. Change one and change the other.
--
-- SECURITY INVOKER on purpose: row level security already limits both tables
-- to the caller's own rows, and auth.uid() names them, so this can only ever
-- add up the caller's own XP.

create or replace function public.study_xp()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select (
    coalesce((
      select sum(
        case
          when not a.correct then 0
          else (case a.confidence when 2 then 12 when 1 then 10 when 0 then 5 else 10 end)
               * (case when a.mode = 'exam' then 2 else 1 end)
        end
      )
      from public.attempts a
      where a.user_id = (select auth.uid())
    ), 0)
    + coalesce((
      select count(*) * 2
      from public.cards_known k
      where k.user_id = (select auth.uid())
    ), 0)
  )::integer;
$$;

revoke all on function public.study_xp() from public, anon;
grant execute on function public.study_xp() to authenticated;
