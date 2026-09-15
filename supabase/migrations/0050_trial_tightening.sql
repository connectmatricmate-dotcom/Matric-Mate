-- Loose ends around the free trial and the AI-only tables, from the 15 Sep audit.
--
-- 1. A trial opened its subject in every board and class. Content policies
--    pair trial_subject() with current_board()/current_grade(), which follow
--    the profile, so a Physics trial on FBISE 9 could switch the profile to
--    Punjab 10 and read Punjab 10 Physics. The trial now remembers the board
--    and class it was started for, and trial_subject() answers only there.
--    Anywhere else it answers a subject that does not exist, so the policies
--    (unchanged) open nothing, rather than null, which they read as a paid plan.
--
-- 2. Cached revision sheets are AI output; the sheet route refuses Basic, but
--    the table itself let Basic read them. And generated_mcqs (empty today)
--    had no trial condition.
--
-- 3. A trial row must name its subject, or the policies read it as a plan.

alter table public.entitlements
  add column if not exists trial_board text,
  add column if not exists trial_grade smallint;

update public.entitlements e
   set trial_board = p.board, trial_grade = p.grade
  from public.profiles p
 where p.id = e.user_id
   and e.plan = 'trial'
   and e.trial_board is null;

create or replace function public.trial_subject()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when e.trial_board is null or (e.trial_board = public.current_board() and e.trial_grade = public.current_grade())
      then e.trial_subject
    else '(outside the trial)'
  end
  from public.entitlements e
  where e.user_id = (select auth.uid())
    and e.plan = 'trial'
    and e.active
    and e.valid_till > now();
$$;

create or replace function public.start_trial(p_subject text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  e public.entitlements%rowtype;
  state text;
  ob jsonb;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  select p.onboarding into ob from public.profiles p where p.id = uid;
  if ob is null or ob ->> 'board' is null or ob ->> 'classLevel' is null then
    raise exception 'finish onboarding first';
  end if;

  state := public.trial_state_for(uid);
  if state = 'used' then
    raise exception 'trial already used';
  elsif state <> 'eligible' then
    raise exception 'has had a plan';
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
  if e.active and e.valid_till is not null and e.valid_till > now() then
    raise exception 'already on a plan';
  end if;

  update public.entitlements
     set active = true,
         plan = 'trial',
         valid_till = now() + interval '3 days',
         trial_subject = p_subject,
         trial_board = public.current_board(),
         trial_grade = public.current_grade(),
         trial_used_at = now(),
         source = 'trial',
         updated_at = now()
   where user_id = uid
  returning * into e;

  return jsonb_build_object('plan', e.plan, 'valid_till', e.valid_till, 'trial_subject', e.trial_subject);
end;
$$;

-- AI output is for plans with AI: not Basic.
create or replace function public.plan_has_ai()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.entitlements e
    where e.user_id = (select auth.uid())
      and e.active
      and e.valid_till is not null
      and e.valid_till > now()
      and coalesce(e.plan, 'monthly') <> 'basic'
  );
$$;
revoke all on function public.plan_has_ai() from public, anon;
grant execute on function public.plan_has_ai() to authenticated;

drop policy if exists "read with plan, own board, grade and trial subject" on public.cheat_sheets;
create policy "read with plan, own board, grade and trial subject" on public.cheat_sheets
  for select to authenticated
  using (
    public.has_active_plan() and public.plan_has_ai() and exists (
      select 1 from public.chapters c
      where c.id = cheat_sheets.chapter_id
        and c.grade = public.current_grade()
        and c.board = public.current_board()
        and ((select public.trial_subject()) is null or c.subject_id = (select public.trial_subject()))
    )
  );

drop policy if exists "read approved" on public.generated_mcqs;
create policy "read approved" on public.generated_mcqs
  for select to authenticated
  using (
    review_status = 'published'
    and public.has_active_plan()
    and ((select public.trial_subject()) is null or subject_id = (select public.trial_subject()))
  );

alter table public.entitlements drop constraint if exists entitlements_trial_has_subject;
alter table public.entitlements
  add constraint entitlements_trial_has_subject check (plan is distinct from 'trial' or trial_subject is not null);
