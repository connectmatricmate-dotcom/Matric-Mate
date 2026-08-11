-- Curriculum content, moved out of the app bundle and into the database.
--
-- 0001 said content lives in packages/core and ships inside both apps, because
-- it is the same for every student and a chapter list has no business costing a
-- round trip. That was right for a demo whose content was written by us. It
-- stops being right the moment content is real, because then it has to change
-- without shipping a new APK, and it has to be reviewed before a student sees
-- it. Both of those need a table.
--
-- Shape notes:
--
-- * Text ids, not uuids: 'phy-3', 'phy3-f1'. They already exist in
--   packages/core and in every screen, they are stable, and they read in a log.
--   A surrogate key here would buy nothing and cost a mapping table.
--
-- * review_status gates everything a student can see. Generated material lands
--   as 'draft' and no policy will serve it. This is the whole safety story for
--   AI-written content: nothing reaches a student that a person did not pass.
--
-- * RLS is SELECT-only for students, on published rows. There is no insert or
--   update policy at all, deliberately: content is written by the ingestion
--   script under the service role, which bypasses RLS. A student who could
--   write an MCQ could write its answer key too.
--
-- * medium is on the row rather than a pair of columns, so a chapter can exist
--   in English before its Urdu translation does, and the missing one is an
--   absent row rather than a null nobody checks.

-- ────────────────────────────────────────────────────────── shared types

do $$ begin
  create type public.review_status as enum ('draft', 'review', 'published');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.content_medium as enum ('en', 'ur');
exception when duplicate_object then null;
end $$;

-- ───────────────────────────────────────────────────── subjects, chapters

create table if not exists public.subjects (
  id             text primary key,
  name           text not null,
  urdu_name      text,
  icon           text not null default 'book',
  compulsory     boolean not null default false,
  study_group    text check (study_group in ('science', 'arts')),
  sort_order     smallint not null default 0,
  review_status  public.review_status not null default 'draft',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.subjects is 'FBISE Class 9 subjects. Mirrors SUBJECTS in packages/core.';

create table if not exists public.chapters (
  id             text primary key,
  subject_id     text not null references public.subjects on delete cascade,
  number         smallint not null,
  -- The board's own unit number, which is not the position in our list:
  -- mathematics examines units 1-7, 14, 15, 17-23 and 29 in Class 9, the gaps
  -- being Class 10's. A student searching for "unit 22" needs to find it.
  board_unit     smallint,
  title          text not null,
  urdu_title     text,
  blurb          text not null default '',
  premium        boolean not null default true,
  audio_minutes  smallint not null default 0,
  review_status  public.review_status not null default 'draft',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (subject_id, number)
);

create index if not exists chapters_subject_idx on public.chapters (subject_id, number);

-- ───────────────────────────────────────────── the FBISE learning outcomes

-- Why the SLOs are a table and not just a build-time file: every generated
-- note, question and flashcard points back at the outcome it was written for.
-- That is what makes the content auditable ("show me the questions for
-- P-09-B-30") and what stops the generator from drifting into whatever the
-- model finds interesting. data/fbise/*.json is the source; this is the copy
-- the rest of the system joins against.
create table if not exists public.curriculum_slos (
  code           text primary key,
  subject_id     text not null references public.subjects on delete cascade,
  domain         text not null,
  sub_domain     text,
  title          text,
  text           text not null,
  -- 'knowledge' | 'understanding' | 'application', as the board grades them.
  cognitive      text check (cognitive in ('knowledge', 'understanding', 'application')),
  -- 'summative' is on the exam, 'formative' is taught but not examined, and
  -- null means the source table merged the column across a content area and we
  -- genuinely do not know. Null is not the same as formative, so do not
  -- collapse them: an outcome wrongly marked unexamined is one we never write
  -- a question for.
  assessment     text check (assessment in ('summative', 'formative')),
  chapter_id     text references public.chapters on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists slos_subject_idx on public.curriculum_slos (subject_id, domain);
create index if not exists slos_chapter_idx on public.curriculum_slos (chapter_id);

comment on table public.curriculum_slos is
  'FBISE Student Learning Outcomes, NCP 2022-23, from the SSC-I Assessment Frameworks.';

-- ──────────────────────────────────────────────────────────── study text

create table if not exists public.chapter_sections (
  id             text primary key,
  chapter_id     text not null references public.chapters on delete cascade,
  medium         public.content_medium not null default 'en',
  position       smallint not null,
  title          text not null,
  -- The Block[] union from packages/core, stored as-is. It is read whole and
  -- rendered whole; splitting it into rows would buy a query nobody runs.
  blocks         jsonb not null default '[]'::jsonb,
  slo_codes      text[] not null default '{}',
  review_status  public.review_status not null default 'draft',
  source         text not null default 'ai' check (source in ('human', 'ai', 'fbise')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (chapter_id, medium, position)
);

create index if not exists sections_chapter_idx on public.chapter_sections (chapter_id, medium, position);

-- ──────────────────────────────────────────────────────────── questions

create table if not exists public.mcqs (
  id             text primary key,
  chapter_id     text not null references public.chapters on delete cascade,
  subject_id     text not null references public.subjects on delete cascade,
  medium         public.content_medium not null default 'en',
  topic          text not null default '',
  q              text not null,
  options        text[] not null check (array_length(options, 1) between 2 and 6),
  -- Zero-based index into options, matching the Mcq type in packages/core.
  answer         smallint not null check (answer >= 0),
  explanation    text not null default '',
  difficulty     text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  slo_code       text references public.curriculum_slos on delete set null,
  review_status  public.review_status not null default 'draft',
  source         text not null default 'ai' check (source in ('human', 'ai', 'fbise')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- An answer index past the end of the options list is a question that can
  -- never be got right, and it is the single most likely way for generated
  -- content to be quietly broken.
  constraint mcq_answer_in_range check (answer < array_length(options, 1))
);

create index if not exists mcqs_chapter_idx on public.mcqs (chapter_id, medium);
create index if not exists mcqs_slo_idx on public.mcqs (slo_code);

create table if not exists public.flashcards (
  id             text primary key,
  chapter_id     text not null references public.chapters on delete cascade,
  medium         public.content_medium not null default 'en',
  front          text not null,
  back           text not null,
  slo_code       text references public.curriculum_slos on delete set null,
  review_status  public.review_status not null default 'draft',
  source         text not null default 'ai' check (source in ('human', 'ai', 'fbise')),
  created_at     timestamptz not null default now()
);

create index if not exists flashcards_chapter_idx on public.flashcards (chapter_id, medium);

create table if not exists public.short_questions (
  id             text primary key,
  chapter_id     text not null references public.chapters on delete cascade,
  medium         public.content_medium not null default 'en',
  marks          smallint not null default 3,
  q              text not null,
  answer         text not null,
  points         text[] not null default '{}',
  slo_code       text references public.curriculum_slos on delete set null,
  review_status  public.review_status not null default 'draft',
  source         text not null default 'ai' check (source in ('human', 'ai', 'fbise')),
  created_at     timestamptz not null default now()
);

create index if not exists short_questions_chapter_idx on public.short_questions (chapter_id, medium);

-- Fill in the blanks. Split sentence, so the app can render the gap as a real
-- input rather than parsing a placeholder out of a string at read time.
create table if not exists public.blanks (
  id             text primary key,
  chapter_id     text not null references public.chapters on delete cascade,
  medium         public.content_medium not null default 'en',
  before_text    text not null default '',
  after_text     text not null default '',
  answer         text not null,
  options        text[] not null default '{}',
  slo_code       text references public.curriculum_slos on delete set null,
  review_status  public.review_status not null default 'draft',
  source         text not null default 'ai' check (source in ('human', 'ai', 'fbise')),
  created_at     timestamptz not null default now()
);

create index if not exists blanks_chapter_idx on public.blanks (chapter_id, medium);

-- ──────────────────────────────────────────────────────────────── audio

create table if not exists public.audio_tracks (
  id             text primary key,
  chapter_id     text not null references public.chapters on delete cascade,
  medium         public.content_medium not null default 'en',
  title          text not null,
  -- Path within the public 'audio' Storage bucket, not a full URL: the project
  -- URL changes between environments and a stored absolute URL would pin the
  -- app to whichever one happened to be current when the row was written.
  storage_path   text not null,
  duration_secs  integer not null default 0,
  bytes          integer not null default 0,
  review_status  public.review_status not null default 'draft',
  created_at     timestamptz not null default now(),
  unique (chapter_id, medium)
);

-- ───────────────────────────────────────────────────── row level security

alter table public.subjects         enable row level security;
alter table public.chapters         enable row level security;
alter table public.curriculum_slos  enable row level security;
alter table public.chapter_sections enable row level security;
alter table public.mcqs             enable row level security;
alter table public.flashcards       enable row level security;
alter table public.short_questions  enable row level security;
alter table public.blanks           enable row level security;
alter table public.audio_tracks     enable row level security;

-- Published rows are readable by anyone signed in. Content is not per-student,
-- so there is no user_id to match on; the gate is review_status and nothing
-- else. Draft and review rows are invisible to the anon and authenticated
-- roles no matter what a client asks for.
do $$
declare t text;
begin
  foreach t in array array[
    'subjects', 'chapters', 'chapter_sections', 'mcqs',
    'flashcards', 'short_questions', 'blanks', 'audio_tracks'
  ]
  loop
    execute format(
      'create policy "read published" on public.%I
         for select to authenticated
         using (review_status = ''published'')', t);
  end loop;
end $$;

-- The outcomes themselves carry no review status: they are the board's words,
-- not ours, and the app shows them as "what this chapter is examined on".
create policy "read slos" on public.curriculum_slos
  for select to authenticated using (true);

-- ───────────────────────────────────────────────────────────── touch rows

create trigger subjects_touch before update on public.subjects
  for each row execute function public.touch_updated_at();

create trigger chapters_touch before update on public.chapters
  for each row execute function public.touch_updated_at();

create trigger sections_touch before update on public.chapter_sections
  for each row execute function public.touch_updated_at();

create trigger mcqs_touch before update on public.mcqs
  for each row execute function public.touch_updated_at();
