-- Two plans and a free trial. From the client's notes of 14 Sep 2026:
--   Basic,   Rs 500 a month, everything except AI
--   Premium, Rs 1,000 a month, everything with AI (the plan that existed)
--   Trial,   free for 3 days, one subject (book) open, once per account
--
-- entitlements.plan was written but never read: any active row opened
-- everything. The plan is now what decides AI (on the server, in
-- lib/ai/guard.ts and the tutor route) and, for a trial, which subject's
-- content the database hands over (below).

-- ─────────────────────────────────────────────── 1. the trial's columns

alter table public.entitlements
  add column if not exists trial_subject text references public.subjects (id),
  add column if not exists trial_used_at timestamptz;

comment on column public.entitlements.trial_subject is
  'The one subject a free trial opens. Set with plan = ''trial'' by start_trial().';
comment on column public.entitlements.trial_used_at is
  'When this account started its free trial. One trial per account, ever.';

-- ─────────────────────────────── 2. a trial reads one subject's content

-- The subject the caller's running trial is limited to, or null when they are
-- not on a trial (a paid plan, or no plan at all, which has_active_plan()
-- already refuses). Read once per query, like current_board().
create or replace function public.trial_subject()
returns text
language sql stable security definer
set search_path = public
as $$
  select e.trial_subject
  from public.entitlements e
  where e.user_id = (select auth.uid())
    and e.plan = 'trial'
    and e.active
    and e.valid_till > now();
$$;

grant execute on function public.trial_subject() to authenticated;

-- The same wall as 0034, with one more condition: on a trial, only the trial
-- subject's chapters. (select ...) so the planner evaluates it once.
do $$
declare t text;
begin
  foreach t in array array[
    'chapter_sections', 'mcqs', 'flashcards', 'short_questions', 'blanks', 'audio_tracks'
  ]
  loop
    execute format('drop policy if exists "read published, plan, own board and grade" on public.%I', t);
    execute format('drop policy if exists "read published, plan, own board, grade and trial subject" on public.%I', t);
    execute format(
      'create policy "read published, plan, own board, grade and trial subject" on public.%I
         for select to authenticated
         using (
           review_status = ''published''
           and public.has_active_plan()
           and exists (
             select 1 from public.chapters c
             where c.id = %I.chapter_id
               and c.grade = public.current_grade()
               and c.board = public.current_board()
               and ((select public.trial_subject()) is null or c.subject_id = (select public.trial_subject()))
           )
         )', t, t);
  end loop;
end $$;

drop policy if exists "read with plan, own board and grade" on public.cheat_sheets;
drop policy if exists "read with plan, own board, grade and trial subject" on public.cheat_sheets;
create policy "read with plan, own board, grade and trial subject" on public.cheat_sheets
  for select to authenticated
  using (
    public.has_active_plan()
    and exists (
      select 1 from public.chapters c
      where c.id = cheat_sheets.chapter_id
        and c.grade = public.current_grade()
        and c.board = public.current_board()
        and ((select public.trial_subject()) is null or c.subject_id = (select public.trial_subject()))
    )
  );

-- ─────────────────────────────────────────────── 3. starting a trial

-- The only way onto a trial, and only once. Refused to an account that has a
-- plan running, has had a trial, or has ever paid: a returning customer is
-- not a trial. The subject has to be one with chapters on the student's own
-- board and class, or the trial would open nothing.
create or replace function public.start_trial(p_subject text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  e public.entitlements%rowtype;
  who text;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  select coalesce(p.role, 'student') into who from public.profiles p where p.id = uid;
  if coalesce(who, 'student') <> 'student' then
    raise exception 'not a student';
  end if;

  if not exists (
    select 1 from public.chapters c
    where c.subject_id = p_subject
      and c.review_status = 'published'
      and c.grade = public.current_grade()
      and c.board = public.current_board()
  ) then
    raise exception 'no chapters for that subject';
  end if;

  select * into e from public.entitlements where user_id = uid for update;
  if not found then
    insert into public.entitlements (user_id) values (uid) returning * into e;
  end if;

  if e.trial_used_at is not null then
    raise exception 'trial already used';
  end if;
  if e.active and (e.valid_till is null or e.valid_till > now()) then
    raise exception 'already on a plan';
  end if;
  if exists (select 1 from public.payments p where p.user_id = uid and p.status = 'paid') then
    raise exception 'has paid before';
  end if;

  update public.entitlements
     set active = true,
         plan = 'trial',
         valid_till = now() + interval '3 days',
         trial_subject = p_subject,
         trial_used_at = now(),
         source = 'trial',
         updated_at = now()
   where user_id = uid
  returning * into e;

  return jsonb_build_object('plan', e.plan, 'valid_till', e.valid_till, 'trial_subject', e.trial_subject);
end;
$$;

revoke all on function public.start_trial(text) from public, anon;
grant execute on function public.start_trial(text) to authenticated;

-- ─────────────────────────────────────────────── 4. the admin's lists

-- The student list gains the school, and "active" stays the running plan of
-- any kind; the plan column says which (trial, basic or monthly).
drop function if exists public.admin_student_list();

create function public.admin_student_list()
returns table (
  id uuid,
  name text,
  email text,
  phone text,
  joined timestamptz,
  plan text,
  active boolean,
  valid_till timestamptz,
  paid_total integer,
  teacher text,
  grade smallint,
  board text,
  school text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'not allowed';
  end if;

  return query
  select
    p.id,
    coalesce(nullif(trim(p.name), ''), split_part(u.email, '@', 1)) as name,
    u.email::text,
    p.phone,
    u.created_at as joined,
    e.plan,
    -- The `active` column is written by the payment path and nothing sweeps it
    -- when a plan runs out, so expiry is checked here rather than trusted.
    coalesce(e.active and e.valid_till > now(), false) as active,
    e.valid_till,
    coalesce(pay.total, 0)::int as paid_total,
    t.full_name as teacher,
    p.grade::smallint,
    p.board,
    p.school
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.entitlements e on e.user_id = p.id
  left join public.affiliates t on t.user_id = p.referred_by
  left join lateral (
    select sum(amount)::int as total
    from public.payments
    where user_id = p.id and status = 'paid'
  ) pay on true
  where coalesce(p.role, 'student') = 'student'
  order by u.created_at desc;
end;
$$;

revoke all on function public.admin_student_list() from public, anon;
grant execute on function public.admin_student_list() to authenticated;

-- Students per school, for the admin's inventory. Grouped on a folded form of
-- the name so "Islamabad Model College" and "islamabad model college " are
-- one school; the most common spelling is the one shown. Paying means a paid
-- plan running now, not a trial.
create or replace function public.admin_school_counts()
returns table (school text, students integer, paying integer, trials integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'not allowed';
  end if;

  return query
  with s as (
    select
      lower(regexp_replace(trim(p.school), '\s+', ' ', 'g')) as k,
      trim(p.school) as shown,
      coalesce(e.active and e.valid_till > now(), false) as running,
      e.plan
    from public.profiles p
    left join public.entitlements e on e.user_id = p.id
    where coalesce(p.role, 'student') = 'student' and nullif(trim(p.school), '') is not null
  )
  select
    (select x.shown from s x where x.k = g.k group by x.shown order by count(*) desc, x.shown limit 1),
    count(*)::int,
    count(*) filter (where g.running and coalesce(g.plan, 'monthly') <> 'trial')::int,
    count(*) filter (where g.running and g.plan = 'trial')::int
  from s g
  group by g.k
  order by count(*) desc, 1;
end;
$$;

revoke all on function public.admin_school_counts() from public, anon;
grant execute on function public.admin_school_counts() to authenticated;
