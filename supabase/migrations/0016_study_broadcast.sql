-- The home screen, live.
--
-- Streak, today's plan and the "this week" chips are all derived from rows a
-- student writes as they study: active_days, attempts, plan_done, read_sections
-- and cards_known. Those already sync, so the two apps agree eventually. They
-- did not agree promptly: a question answered on a phone did not move the
-- laptop's streak until the laptop happened to hydrate again, which in practice
-- meant a reload.
--
-- One signal per student covers all five tables. The payload says only which
-- table moved, never a row: the subscriber re-reads through its own
-- authenticated session, so a public topic never carries a student's work.
--
-- Broadcast, not postgres_changes, per docs/engineering/Supabase Realtime
-- Guide.md, and per-user topic per the naming convention there.

create or replace function public.broadcast_study_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  -- Deletes matter too: unticking a plan task is a delete, and the other
  -- device has to hear about it.
  target := coalesce(new.user_id, old.user_id);
  if target is null then
    return coalesce(new, old);
  end if;

  perform realtime.send(
    jsonb_build_object('table', tg_table_name),
    'change',
    'study:' || target::text,
    false  -- private := false, matching config: { private: false } on the client
  );
  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['active_days', 'attempts', 'plan_done', 'read_sections', 'cards_known']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_broadcast', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.broadcast_study_change()',
      t || '_broadcast', t
    );
  end loop;
end;
$$;

-- No grants, for the reason in the guide: the function is security definer and
-- fires as the owner whoever writes the row, so granting execute would only
-- expose it as a callable RPC.
