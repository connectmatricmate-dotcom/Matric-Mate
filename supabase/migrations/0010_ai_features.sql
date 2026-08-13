-- AI becomes the app's second brain: three tables for what it produces.
--
-- ai_sessions: practice a student asked the AI to build for them, one row per
-- set (MCQs, flashcards, blanks, short questions, or a whole mock paper).
-- Grounded server-side on our own chapter text and saved here so the same set
-- opens on the phone and the website. Deliberately separate from the curated
-- bank tables: these are personal study aids, clearly labelled AI-made, and
-- they never mix into the shared question pool (that path stays behind the
-- generated_mcqs review gate).
--
-- coach_reports: the weekly AI coach, one row per student per week, generated
-- once and cached so the dashboard card costs one model call a week, not one
-- per visit.
--
-- cheat_sheets: revision sheets cached globally per chapter and medium. The
-- sheet is the same for every student, so the first request pays for the
-- generation and everyone after reads it for free.

create table if not exists public.ai_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  kind       text not null check (kind in ('mcq', 'flashcards', 'blanks', 'shortq', 'paper')),
  title      text not null,
  subject_id text references public.subjects on delete set null,
  chapter_id text references public.chapters on delete set null,
  topic      text,
  medium     public.content_medium not null default 'en',
  items      jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_sessions_user_idx on public.ai_sessions (user_id, created_at desc);

alter table public.ai_sessions enable row level security;

-- Students read and prune their own sets; rows are written by the server
-- routes with the service key, so the items are always server-generated.
create policy "read own sessions" on public.ai_sessions
  for select using ((select auth.uid()) = user_id);
create policy "delete own sessions" on public.ai_sessions
  for delete using ((select auth.uid()) = user_id);

create table if not exists public.coach_reports (
  user_id    uuid not null references auth.users on delete cascade,
  week       date not null,
  body       jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, week)
);

alter table public.coach_reports enable row level security;

create policy "read own reports" on public.coach_reports
  for select using ((select auth.uid()) = user_id);

create table if not exists public.cheat_sheets (
  chapter_id text not null references public.chapters on delete cascade,
  medium     public.content_medium not null default 'en',
  body       text not null,
  created_at timestamptz not null default now(),
  primary key (chapter_id, medium)
);

alter table public.cheat_sheets enable row level security;

-- Same wall as chapter content: published-course material for paying accounts.
create policy "read with plan" on public.cheat_sheets
  for select to authenticated
  using (public.has_active_plan());
