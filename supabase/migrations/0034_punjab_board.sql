-- The app learns a second board: Punjab, beside FBISE.
--
-- 0012 said "same shape any future board column would follow" when grade was
-- added to a chapter's identity. This is that column, and it follows exactly
-- that shape.
--
-- Every chapter carries a board, defaulting to 'fbise' so the whole existing
-- catalogue is untouched. Punjab chapters arrive with board 'punjab' and ids
-- shaped like pj-phy-9-1, keeping the subject prefix every parser relies on.
-- Subjects stay shared: a subject with no chapters for a board simply shows
-- nothing there, which is how grade already behaves.
--
-- WHY ONLY chapters NEEDS THE COLUMN
--
-- Every other content table (sections, mcqs, flashcards, short questions,
-- blanks, audio, cheat sheets) is already gated by joining to its chapter and
-- comparing current_grade(). Adding board to the same join gates the entire
-- content tree from one place, and makes it impossible for a table to be
-- board-aware in the app but not in the database.
--
-- THE HOLE THIS CLOSES
--
-- profiles.board has accepted 'punjab' since 0001 and onboarding has offered
-- "Punjab Board" all along, but no content table had a board dimension. A
-- student who picked Punjab was served the FBISE syllabus, silently, labelled
-- as theirs. That is a correctness bug rather than a missing feature, and it
-- shipped. After this migration a Punjab account sees Punjab chapters, which
-- is nothing at all until the catalogue is seeded: an empty subject is honest,
-- the wrong board's chapters are not.

alter table public.chapters
  add column if not exists board text not null default 'fbise'
  check (board in ('fbise', 'punjab'));

create index if not exists chapters_board_idx on public.chapters (board, grade, subject_id, number);

-- A chapter's identity is now board + grade + subject + number. Physics
-- chapter 3 exists once per board per class.
alter table public.chapters drop constraint if exists chapters_subject_grade_number_key;
alter table public.chapters add constraint chapters_board_subject_grade_number_key
  unique (board, subject_id, grade, number);

/*
 * Mirrors current_grade(): SECURITY DEFINER so it reads profiles past RLS,
 * STABLE so the planner runs it once per query, and it defaults to 'fbise'
 * so a missing profile row degrades to the board we actually have content
 * for rather than to an empty app.
 */
create or replace function public.current_board()
returns text
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select p.board from public.profiles p where p.id = (select auth.uid())),
    'fbise'
  );
$$;

grant execute on function public.current_board() to authenticated;

-- Chapters: published, in the caller's own class, on the caller's own board.
drop policy if exists "read own grade" on public.chapters;
create policy "read own board and grade" on public.chapters
  for select to authenticated
  using (
    review_status = 'published'
    and grade = public.current_grade()
    and board = public.current_board()
  );

-- Everything hanging off a chapter rides the same wall, through the join it
-- already used for grade.
do $$
declare t text;
begin
  foreach t in array array[
    'chapter_sections', 'mcqs', 'flashcards', 'short_questions', 'blanks', 'audio_tracks'
  ]
  loop
    execute format('drop policy if exists "read published, plan, own grade" on public.%I', t);
    execute format(
      'create policy "read published, plan, own board and grade" on public.%I
         for select to authenticated
         using (
           review_status = ''published''
           and public.has_active_plan()
           and exists (
             select 1 from public.chapters c
             where c.id = %I.chapter_id
               and c.grade = public.current_grade()
               and c.board = public.current_board()
           )
         )', t, t);
  end loop;
end $$;

drop policy if exists "read with plan, own grade" on public.cheat_sheets;
create policy "read with plan, own board and grade" on public.cheat_sheets
  for select to authenticated
  using (
    public.has_active_plan()
    and exists (
      select 1 from public.chapters c
      where c.id = cheat_sheets.chapter_id
        and c.grade = public.current_grade()
        and c.board = public.current_board()
    )
  );

/*
 * The curriculum table becomes board-aware too.
 *
 * FBISE publishes Student Learning Outcomes with its own codes, and every
 * generated note and question points at the outcome it was written for. That
 * is the audit trail.
 *
 * Punjab publishes no such thing. PCTB holds the curriculum authority and
 * issues schemes of studies and textbooks, not standalone SLO matrices, and
 * PBCC sets the paper pattern: 25% analytical, 75% textbook. So for Punjab
 * the examinable unit is the textbook topic, and the codes in this table are
 * ones we mint ourselves from the official contents, shaped PJ-PHY-09-U3-T2.
 *
 * The audit trail is therefore identical in shape and honest about its
 * source: `origin` says whether a row is the board's own outcome or our
 * reading of the board's textbook, so nothing downstream can mistake one for
 * the other.
 */
alter table public.curriculum_slos
  add column if not exists board text not null default 'fbise'
  check (board in ('fbise', 'punjab'));

alter table public.curriculum_slos
  add column if not exists origin text not null default 'board_slo'
  check (origin in ('board_slo', 'textbook_topic'));

comment on column public.curriculum_slos.origin is
  'board_slo: published by the board with its own code. textbook_topic: derived by us from the official textbook contents, because that board publishes no SLO codes.';

create index if not exists slos_board_idx on public.curriculum_slos (board, subject_id);
