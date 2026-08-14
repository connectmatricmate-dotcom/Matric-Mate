-- The app learns a second class: FBISE SSC-II (Class 10) beside SSC-I.
--
-- Every chapter now carries a grade, defaulting to 9 so the whole existing
-- catalogue is untouched. Class 10 chapters arrive later with grade 10 and
-- ids shaped like phy-10-1, keeping the subject prefix every parser relies
-- on. Subjects are shared across grades; a subject with no chapters for a
-- grade simply shows nothing there.
--
-- Each STUDENT also carries a grade, on profiles, and that is the anti-
-- sharing wall the client asked about. An account is one class at a time,
-- enforced where no app can decline to run it:
--
--   1. Content policies serve only rows whose chapter matches the caller's
--      own grade. A Class 9 login cannot read Class 10 rows off the REST
--      API, whatever client it uses, so one subscription cannot feed a
--      9th and a 10th grader side by side.
--   2. Switching class is throttled by a trigger: once every 7 days. The
--      switch wipes local progress in the apps anyway; the cooldown makes
--      ping-ponging an account between two siblings useless as a strategy.
--
-- current_grade() mirrors has_active_plan(): SECURITY DEFINER so it reads
-- profiles past RLS, STABLE so the planner runs it once per query, and it
-- defaults to 9 so a missing profile row degrades to the bigger class
-- rather than to an empty app.

alter table public.chapters add column if not exists grade smallint not null default 9;
create index if not exists chapters_grade_idx on public.chapters (grade, subject_id, number);

alter table public.profiles add column if not exists grade smallint not null default 9
  check (grade in (9, 10));
alter table public.profiles add column if not exists grade_changed_at timestamptz;

create or replace function public.current_grade()
returns smallint
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select p.grade from public.profiles p where p.id = (select auth.uid())),
    9
  );
$$;

grant execute on function public.current_grade() to authenticated;

-- The shelf: signed-in students browse only their own class's chapters.
drop policy if exists "read chapters" on public.chapters;
drop policy if exists "read published" on public.chapters;
do $$
begin
  -- Whatever the existing authenticated read policy is called, replace it.
  if exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'chapters'
  ) then
    execute (
      select string_agg(format('drop policy %I on public.chapters', policyname), '; ')
      from pg_policies
      where schemaname = 'public' and tablename = 'chapters' and cmd = 'SELECT'
    );
  end if;
end $$;

create policy "read own grade" on public.chapters
  for select to authenticated
  using (review_status = 'published' and grade = public.current_grade());

-- The goods: published, paid for, and in the caller's own class.
do $$
declare t text;
begin
  foreach t in array array[
    'chapter_sections', 'mcqs', 'flashcards', 'short_questions', 'blanks', 'audio_tracks'
  ]
  loop
    execute format('drop policy if exists "read published, plan required" on public.%I', t);
    execute format(
      'create policy "read published, plan, own grade" on public.%I
         for select to authenticated
         using (
           review_status = ''published''
           and public.has_active_plan()
           and exists (
             select 1 from public.chapters c
             where c.id = %I.chapter_id and c.grade = public.current_grade()
           )
         )', t, t);
  end loop;
end $$;

-- Cheat sheets ride the same wall.
drop policy if exists "read with plan" on public.cheat_sheets;
create policy "read with plan, own grade" on public.cheat_sheets
  for select to authenticated
  using (
    public.has_active_plan()
    and exists (
      select 1 from public.chapters c
      where c.id = cheat_sheets.chapter_id and c.grade = public.current_grade()
    )
  );

-- Switching class is a real decision, not a toggle: once a week, enforced
-- here so no client build can bypass it. The first-ever switch (or the row
-- being created) sets the timestamp without tripping the check.
create or replace function public.enforce_grade_cooldown()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.grade is distinct from old.grade then
    if old.grade_changed_at is not null and old.grade_changed_at > now() - interval '7 days' then
      raise exception 'grade_cooldown: class was changed on %, next change allowed after %',
        old.grade_changed_at, old.grade_changed_at + interval '7 days';
    end if;
    new.grade_changed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists grade_cooldown on public.profiles;
create trigger grade_cooldown
  before update on public.profiles
  for each row execute function public.enforce_grade_cooldown();
