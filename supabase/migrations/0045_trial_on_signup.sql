-- The free trial starts itself, plans end with a reminder, and AI answers can
-- be reported. The client's decisions of 15 Sep 2026:
--
--   * no choice between a trial and a plan after sign-up: every new student
--     goes straight into the 3-day trial, and picks its one subject on the
--     first screen after onboarding (the 3 days start at that tap)
--   * when a trial or a paid month ends, the student is told once, in the app
--     without a word about paying (Google Play), and by email with a link to
--     the website
--   * every AI answer can be reported from inside the app (Google Play's rule
--     for apps that generate content with AI)

-- ─────────────────────────────── 1. a plan with no end date is not running

-- The website already reads it this way (lib/entitlement.ts planIsActive);
-- the database read a null end date as "forever". No active row has one
-- (checked 15 Sep 2026), so this changes nothing today and stops the two from
-- disagreeing about a hand-made row tomorrow.
create or replace function public.has_active_plan()
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.entitlements e
    where e.user_id = (select auth.uid())
      and e.active
      and e.valid_till is not null
      and e.valid_till > now()
  );
$$;

-- ─────────────────────────────────────── 2. who may start the free trial

-- One answer for both apps and for start_trial itself, so the screen that
-- offers the trial and the function that grants it can never disagree.
--   'eligible'  never trialled, never had a plan of any kind
--   'used'      has had the trial
--   'no'        has had a plan (paid, given by hand, or revoked), or is staff
-- A revoked plan leaves its payment 'refunded', which used to make the account
-- look brand new and able to take a trial.
create or replace function public.trial_state_for(uid uuid)
returns text
language sql
stable security definer
set search_path = ''
as $$
  select case
    when coalesce((select p.role from public.profiles p where p.id = uid), 'student') <> 'student' then 'no'
    when exists (select 1 from public.entitlements e where e.user_id = uid and e.trial_used_at is not null) then 'used'
    when exists (select 1 from public.payments p where p.user_id = uid and p.status in ('paid', 'refunded')) then 'no'
    when exists (select 1 from public.entitlements e where e.user_id = uid and e.plan is not null and e.plan <> 'trial') then 'no'
    else 'eligible'
  end;
$$;

revoke all on function public.trial_state_for(uuid) from public, anon, authenticated;

create or replace function public.trial_state()
returns text
language sql
stable security definer
set search_path = ''
as $$
  select public.trial_state_for(auth.uid());
$$;

revoke all on function public.trial_state() from public, anon;
grant execute on function public.trial_state() to authenticated;

-- The same trial as before (3 days, one subject), refused on the same rules,
-- plus one: onboarding has to be finished, or the subject would be checked
-- against the default class and board rather than the student's own.
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

-- ─────────────────────────────────────────── 3. reported AI answers

-- Google Play requires an app that generates content with AI to let people
-- report offensive output without leaving the app. Every AI surface offers
-- "Report this answer"; the report lands here and in the admin panel.
create table if not exists public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  surface text not null check (surface in ('tutor', 'ai_test', 'paper', 'sheet', 'career', 'coach', 'check')),
  ref text check (char_length(ref) <= 120),
  excerpt text check (char_length(excerpt) <= 2000),
  reason text not null check (reason in ('wrong', 'offensive', 'unsafe', 'other')),
  note text check (char_length(note) <= 500),
  status text not null default 'new' check (status in ('new', 'seen')),
  created_at timestamptz not null default now()
);

create index if not exists ai_reports_new_idx on public.ai_reports (status, created_at desc);

alter table public.ai_reports enable row level security;

drop policy if exists "report as yourself" on public.ai_reports;
create policy "report as yourself" on public.ai_reports
  for insert to authenticated
  with check (user_id = (select auth.uid()));

grant insert on public.ai_reports to authenticated;

comment on table public.ai_reports is
  'AI answers students reported from inside the apps. Read in the admin panel with the service role.';

-- ─────────────────────────────── 4. each plan reminder is sent once

-- The hourly plans job (/api/cron/plans) looks for trials and plans ending or
-- ended, and claims a row here before it sends, keyed on the end date it is
-- about: a renewal moves the end date, so the next month gets its own
-- reminders, and a second run the same hour finds the claim and sends nothing.
create table if not exists public.plan_notices (
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('trial_ending', 'trial_ended', 'plan_ending', 'plan_ended')),
  until timestamptz not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, until)
);

alter table public.plan_notices enable row level security;

comment on table public.plan_notices is
  'One row per plan reminder sent (kind, for the plan end date it is about). Server only.';

-- ─────────────────────────────────────────── 5. the hourly plans job

select cron.unschedule(jobid) from cron.job where jobname = 'matricmate-plans';
select cron.schedule('matricmate-plans', '20 * * * *', $$select jobs.call_endpoint('/api/cron/plans')$$);
