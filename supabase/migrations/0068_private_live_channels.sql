-- The live-update channels become private: only the student can listen.
--
-- Three broadcasts keep a student's open devices in step: quota:<id> (the AI
-- count), study:<id> (a write to their history) and coach:<id> (a new coach
-- report). They were public topics: anyone who knew a student's id could
-- listen in, and could send a made-up AI count to the student's devices,
-- which locked their tutor until the app next asked the server (15 Sep audit;
-- teachers see student ids in their report addresses).
--
-- Now the database sends them as private messages, both apps join with
-- { private: true }, and realtime.messages lets a signed-in user read only
-- their own three topics. There is no insert policy, so no client can send on
-- any topic at all: only these triggers do, as the database.

create or replace function public.broadcast_ai_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send(
    jsonb_build_object('used', new.used, 'day', new.day),
    'change',
    'quota:' || new.user_id::text,
    true  -- private: matching { private: true } on both apps
  );
  return new;
end;
$$;

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
    true  -- private: matching { private: true } on both apps
  );
  return coalesce(new, old);
end;
$$;

create or replace function public.broadcast_coach_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send(
    jsonb_build_object('period', new.period),
    'change',
    'coach:' || new.user_id::text,
    true
  );
  return new;
end;
$$;

drop policy if exists "own live topics" on realtime.messages;
create policy "own live topics" on realtime.messages
  for select to authenticated
  using (
    realtime.topic() in (
      'quota:' || (select auth.uid())::text,
      'study:' || (select auth.uid())::text,
      'coach:' || (select auth.uid())::text
    )
  );
