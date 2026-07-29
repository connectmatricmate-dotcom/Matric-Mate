-- MatricMate, initial schema.
--
-- Shape notes, so the next person does not have to guess:
--
-- * Curriculum content (subjects, chapters, MCQs, papers) is NOT here. It lives
--   in packages/core and ships inside both apps, because it is the same for
--   every student, it must work offline, and a chapter list has no business
--   costing a round trip. The database holds only what is true about a person.
--
-- * Every table carries user_id and every table has RLS. There is no "read all"
--   path for the anon key: a student can reach their own rows and nothing else.
--
-- * entitlements and payments are writable ONLY by the service role, because
--   they are written by the payment webhook. If a student could write their own
--   entitlement row, the paywall would be decorative.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────── profiles

create table public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  name          text not null default '',
  contact       text not null default '',
  class_level   smallint not null default 9 check (class_level in (9, 10)),
  board         text not null default 'fbise' check (board in ('fbise', 'punjab')),
  medium        text not null default 'en' check (medium in ('en', 'ur')),
  study_group   text not null default 'science' check (study_group in ('science', 'arts')),
  subjects      text[] not null default '{}',
  -- Interface preferences: language, reminders, font scale. A jsonb blob because
  -- these change often and none of them are ever queried across users.
  settings      jsonb not null default '{}'::jsonb,
  xp            integer not null default 0 check (xp >= 0),
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is 'One row per student, created automatically on sign-up.';

-- ────────────────────────────────────────────────────────── study activity

-- The row that powers every analytic in the app. `confidence` is the whole
-- point: without it we can only say what a student got wrong, not what they
-- were wrong about while feeling sure.
create table public.attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  mcq_id      text not null,
  chapter_id  text not null,
  subject_id  text not null,
  topic       text not null default '',
  correct     boolean not null,
  confidence  smallint check (confidence between 0 and 2),
  mode        text not null default 'practice',
  at          timestamptz not null default now()
);

create index attempts_user_at_idx on public.attempts (user_id, at desc);
create index attempts_user_topic_idx on public.attempts (user_id, topic);

create table public.results (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  subject_id  text not null,
  chapter_id  text,
  label       text not null,
  score       integer not null,
  total       integer not null check (total > 0),
  xp          integer not null default 0,
  mode        text not null default 'practice',
  at          timestamptz not null default now()
);

create index results_user_at_idx on public.results (user_id, at desc);

-- Reading progress, one row per section. Composite key rather than a surrogate:
-- re-reading a section is not a new fact.
create table public.read_sections (
  user_id       uuid not null references auth.users on delete cascade,
  section_id    text not null,
  chapter_id    text not null,
  section_index smallint not null default 0,
  at            timestamptz not null default now(),
  primary key (user_id, section_id)
);

create table public.cards_known (
  user_id uuid not null references auth.users on delete cascade,
  card_id text not null,
  at      timestamptz not null default now(),
  primary key (user_id, card_id)
);

create table public.downloads (
  user_id    uuid not null references auth.users on delete cascade,
  chapter_id text not null,
  at         timestamptz not null default now(),
  primary key (user_id, chapter_id)
);

-- Today's plan is regenerated daily, so a tick is only meaningful with its date.
create table public.plan_done (
  user_id uuid not null references auth.users on delete cascade,
  task_id text not null,
  day     date not null default current_date,
  primary key (user_id, task_id, day)
);

-- Streaks are derived from this, so it is a date and not a timestamp: two
-- sessions in one evening are one active day.
create table public.active_days (
  user_id uuid not null references auth.users on delete cascade,
  day     date not null,
  primary key (user_id, day)
);

-- ───────────────────────────────────────────────────────────── AI tutor

create table public.threads (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  title         text not null,
  context_label text,
  messages      jsonb not null default '[]'::jsonb,
  at            timestamptz not null default now()
);

create index threads_user_at_idx on public.threads (user_id, at desc);

-- The daily quota. Enforced server-side in the Edge Function that calls the
-- model: a client-side counter is a suggestion, not a limit.
create table public.ai_usage (
  user_id uuid not null references auth.users on delete cascade,
  day     date not null default current_date,
  used    integer not null default 0 check (used >= 0),
  primary key (user_id, day)
);

-- ─────────────────────────────────────────────────────── notifications

create table public.notifications (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind    text not null check (kind in ('streak', 'reminder', 'report', 'payment')),
  title   text not null,
  body    text not null default '',
  -- A destination name, not a URL: the two apps spell the same screen
  -- differently. See NotificationTarget in packages/core.
  target  text,
  read    boolean not null default false,
  at      timestamptz not null default now()
);

create index notifications_user_at_idx on public.notifications (user_id, at desc);

-- ──────────────────────────────────────────────────── money and access

-- What a student is entitled to, and the only thing the paywall consults.
-- Written by the payment webhook under the service role. Never by the student.
create table public.entitlements (
  user_id    uuid primary key references auth.users on delete cascade,
  active     boolean not null default false,
  plan       text,
  valid_till timestamptz,
  -- Where this came from: 'safepay', or 'manual' for a support grant.
  source     text not null default 'safepay',
  updated_at timestamptz not null default now()
);

create table public.payments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users on delete set null,
  -- Safepay's tracker. Unique so a webhook delivered twice cannot be counted
  -- twice; at-least-once delivery is the norm, not the exception.
  tracker    text not null unique,
  reference  text,
  order_id   text,
  plan       text,
  amount     integer not null,
  currency   text not null default 'PKR',
  status     text not null default 'pending'
             check (status in ('pending', 'paid', 'failed', 'refunded', 'cancelled')),
  raw        jsonb,
  at         timestamptz not null default now()
);

create index payments_user_at_idx on public.payments (user_id, at desc);

-- ─────────────────────────────────────────────── a profile on sign-up

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
-- Empty search_path so a table planted in a user-writable schema cannot be
-- resolved ahead of ours inside a security-definer function.
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, contact)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.email, new.phone, '')
  );
  insert into public.entitlements (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────────────────────────────── row level security

alter table public.profiles      enable row level security;
alter table public.attempts      enable row level security;
alter table public.results       enable row level security;
alter table public.read_sections enable row level security;
alter table public.cards_known   enable row level security;
alter table public.downloads     enable row level security;
alter table public.plan_done     enable row level security;
alter table public.active_days   enable row level security;
alter table public.threads       enable row level security;
alter table public.ai_usage      enable row level security;
alter table public.notifications enable row level security;
alter table public.entitlements  enable row level security;
alter table public.payments      enable row level security;

-- Profiles key on id; everything else keys on user_id.
create policy "own profile" on public.profiles
  for all using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

do $$
declare t text;
begin
  foreach t in array array[
    'attempts', 'results', 'read_sections', 'cards_known', 'downloads',
    'plan_done', 'active_days', 'threads', 'ai_usage', 'notifications'
  ]
  loop
    execute format(
      'create policy "own rows" on public.%I for all
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- Read-only to the student. The service role bypasses RLS, which is how the
-- webhook writes them, so no insert or update policy is defined on purpose.
create policy "read own entitlement" on public.entitlements
  for select using ((select auth.uid()) = user_id);

create policy "read own payments" on public.payments
  for select using ((select auth.uid()) = user_id);

-- ──────────────────────────────────────────────────────── convenience

-- `updated_at` that is actually maintained.
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger entitlements_touch before update on public.entitlements
  for each row execute function public.touch_updated_at();
