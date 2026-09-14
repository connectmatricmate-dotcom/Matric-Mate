-- The school a student goes to, the time they spend in the app each day, and
-- the day's report that both the student and the teacher who referred them see.
-- From the client's notes of 14 Sep 2026.

-- ─────────────────────────────────────────────────── 1. school

-- Optional, typed by the student at signup or later in their account. The
-- client wants an inventory of which schools students come from, and later to
-- run school batches; for now it is only the name. Free text, so the admin
-- count groups it case-insensitively.
alter table public.profiles
  add column if not exists school text
  check (school is null or char_length(school) between 2 and 120);

comment on column public.profiles.school is
  'The student''s school, as they typed it. Optional. Grouped case-insensitively for the admin''s schools count.';

-- Students update their own profile through a column allow-list (see 0001).
grant update (school) on public.profiles to authenticated;

-- The signup trigger, as in 0029, now also carrying the school from the
-- signup form's metadata. A name outside the column's bounds is dropped, never
-- a reason to fail the signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ref_code text := nullif(trim(upper(new.raw_user_meta_data ->> 'ref')), '');
  ref_owner uuid;
  phone text := nullif(trim(new.raw_user_meta_data ->> 'phone'), '');
  school text := nullif(regexp_replace(trim(coalesce(new.raw_user_meta_data ->> 'school', '')), '\s+', ' ', 'g'), '');
begin
  if ref_code is not null then
    select a.user_id into ref_owner
    from public.affiliates a
    where a.code = ref_code and a.active
    limit 1;
  end if;

  if phone is not null and phone !~ '^\+92\d{10}$' then
    phone := null;
  end if;

  if school is not null and char_length(school) not between 2 and 120 then
    school := null;
  end if;

  insert into public.profiles (id, name, contact, phone, school, referred_by, referred_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.email, new.phone, ''),
    phone,
    school,
    ref_owner,
    case when ref_owner is not null then now() else null end
  );
  insert into public.entitlements (user_id) values (new.id);
  return new;
end;
$$;

-- ─────────────────────────────────────────────── 2. time in the app

-- Seconds with the app open, per Karachi day. The client asked to see whether
-- a student opened the app today and for how long, and nothing recorded that:
-- active_days says a student studied, not that they came in or for how long.
-- A row existing for a day means the app was opened that day.
create table if not exists public.study_time (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  seconds integer not null default 0 check (seconds between 0 and 86400),
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.study_time enable row level security;

drop policy if exists "read own time" on public.study_time;
create policy "read own time" on public.study_time
  for select using ((select auth.uid()) = user_id);

comment on table public.study_time is
  'Seconds the app was open and in use, per student per Karachi day. Written only through add_study_time.';

-- The only way in. The day is the server's, in Karachi, so a phone with the
-- wrong clock cannot write another day, and one call adds at most two
-- minutes: the apps send a minute at a time, and a stuck or replayed call
-- cannot add an hour. Zero seconds just marks the app as opened today.
create or replace function public.add_study_time(p_seconds integer)
returns integer
language sql
security definer
set search_path = ''
as $$
  insert into public.study_time as t (user_id, day, seconds)
  values (auth.uid(), (now() at time zone 'Asia/Karachi')::date, least(greatest(coalesce(p_seconds, 0), 0), 120))
  on conflict (user_id, day) do update
    set seconds = least(t.seconds + least(greatest(coalesce(p_seconds, 0), 0), 120), 86400),
        last_at = now()
  returning seconds;
$$;

revoke all on function public.add_study_time(integer) from public, anon;
grant execute on function public.add_study_time(integer) to authenticated;

-- ─────────────────────────────────────────────── 3. the day's report

-- Everything a student did on one Karachi day, in one read: time in the app,
-- questions and how many were right, per subject, sections read, flashcards
-- learned, tests finished, and the chapters touched. The phone keeps no dates
-- for reading or flashcards, so this is the one place the whole day exists.
--
-- A student reads their own. The website's server, with the service role,
-- reads a referred student's for the teacher's view; it scopes that by
-- referred_by itself before calling.
create or replace function public.daily_report(p_day date default null, p_user uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := coalesce(p_user, auth.uid());
  d date := coalesce(p_day, (now() at time zone 'Asia/Karachi')::date);
  report jsonb;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if p_user is not null and p_user is distinct from auth.uid() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'not allowed';
  end if;

  with
    a as (
      select subject_id, chapter_id, correct
      from public.attempts
      where user_id = uid and at >= (d::timestamp at time zone 'Asia/Karachi') and at < ((d + 1)::timestamp at time zone 'Asia/Karachi')
    ),
    r as (
      select chapter_id
      from public.read_sections
      where user_id = uid and at >= (d::timestamp at time zone 'Asia/Karachi') and at < ((d + 1)::timestamp at time zone 'Asia/Karachi')
    ),
    t as (
      select label, score, total, at
      from public.results
      where user_id = uid and at >= (d::timestamp at time zone 'Asia/Karachi') and at < ((d + 1)::timestamp at time zone 'Asia/Karachi')
    )
  select jsonb_build_object(
    'day', d,
    'opened', exists (select 1 from public.study_time s where s.user_id = uid and s.day = d),
    'seconds', coalesce((select s.seconds from public.study_time s where s.user_id = uid and s.day = d), 0),
    'studied', exists (select 1 from public.active_days ad where ad.user_id = uid and ad.day = d),
    'questions', (select count(*) from a),
    'correct', (select count(*) from a where correct),
    'subjects', coalesce((
      select jsonb_agg(jsonb_build_object('subject', subject_id, 'questions', n, 'correct', c) order by n desc)
      from (select subject_id, count(*) as n, count(*) filter (where correct) as c from a group by subject_id) x
    ), '[]'::jsonb),
    'sections', (select count(*) from r),
    'cards', (
      select count(*) from public.cards_known k
      where k.user_id = uid and k.at >= (d::timestamp at time zone 'Asia/Karachi') and k.at < ((d + 1)::timestamp at time zone 'Asia/Karachi')
    ),
    'tests', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'score', score, 'total', total) order by at) from t), '[]'::jsonb),
    'chapters', coalesce((select jsonb_agg(distinct chapter_id) from (select chapter_id from a union select chapter_id from r) c where chapter_id is not null), '[]'::jsonb)
  ) into report;
  return report;
end;
$$;

revoke all on function public.daily_report(date, uuid) from public, anon;
grant execute on function public.daily_report(date, uuid) to authenticated, service_role;

-- The teacher's list: for many students at once, whether each opened the app
-- and studied on the day, the time and questions, and their last active day.
-- Service role only; the caller has already limited the ids to the teacher's
-- own students.
create or replace function public.students_activity(p_users uuid[], p_day date default null)
returns table (user_id uuid, opened boolean, studied boolean, seconds integer, questions integer, last_active date)
language sql
stable
security definer
set search_path = ''
as $$
  with d as (select coalesce(p_day, (now() at time zone 'Asia/Karachi')::date) as day)
  select
    u.id,
    exists (select 1 from public.study_time s, d where s.user_id = u.id and s.day = d.day),
    exists (select 1 from public.active_days ad, d where ad.user_id = u.id and ad.day = d.day),
    coalesce((select s.seconds from public.study_time s, d where s.user_id = u.id and s.day = d.day), 0),
    (select count(*)::integer from public.attempts att, d
      where att.user_id = u.id
        and att.at >= (d.day::timestamp at time zone 'Asia/Karachi')
        and att.at < ((d.day + 1)::timestamp at time zone 'Asia/Karachi')),
    greatest(
      (select max(ad.day) from public.active_days ad where ad.user_id = u.id),
      (select max(s.day) from public.study_time s where s.user_id = u.id)
    )
  from unnest(p_users) as u(id);
$$;

revoke all on function public.students_activity(uuid[], date) from public, anon, authenticated;
grant execute on function public.students_activity(uuid[], date) to service_role;

-- ─────────────────────────────────────────── 4. career guidance, cached

-- The AI's reading of which streams and fields a student's results point to.
-- Written by the server after a model call and read back for a week, so the
-- screen does not spend a question every time it opens.
create table if not exists public.career_reports (
  user_id uuid primary key references auth.users (id) on delete cascade,
  body jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.career_reports enable row level security;

drop policy if exists "read own career report" on public.career_reports;
create policy "read own career report" on public.career_reports
  for select using ((select auth.uid()) = user_id);

comment on table public.career_reports is
  'Latest AI career guidance per student. Written by /api/ai/career with the service role, read by the student.';
