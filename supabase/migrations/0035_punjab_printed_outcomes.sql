-- Punjab's outcomes turn out to be printed, and 0034 did not know that.
--
-- 0034 assumed Punjab publishes no learning outcomes, so the plan was to use
-- each textbook topic as the examinable unit and to mark those rows
-- origin = 'textbook_topic'. Then the 2023 editions were read page by page:
-- every chapter opens with a box headed "Student's learning outcomes (SLOs)",
-- the revised national curriculum's own statements, printed verbatim. Those
-- are real outcomes, not our reading of a contents page, and they deserve a
-- label that says so.
--
--   board_slo       published by the board, with the board's own code (FBISE)
--   textbook_slo    printed in the board's official textbook, verbatim; the
--                   code is ours because the book prints none
--   textbook_topic  a topic or lesson title from the official textbook, used
--                   only where a chapter prints no outcomes (language lessons)
--
-- Codes stay minted by us, shaped PJ-PHY-10-C10-S03: board, subject, class,
-- chapter as the book numbers it, then S for a printed outcome or T for a
-- topic standing in for one.
--
-- A correction to 0034's comment, which is not rewritten because it has run:
-- Punjab chapter ids are phy-pj-9-1, not pj-phy-9-1. Both apps and the
-- scripts read a chapter's subject as everything before the first hyphen, so
-- the subject has to lead.

-- 0034 declared the check inline, so Postgres chose its name. Drop whatever
-- check mentions origin rather than trust a guessed name and leave the old
-- one standing beside the new.
do $$
declare c text;
begin
  for c in
    select con.conname from pg_constraint con
    where con.conrelid = 'public.curriculum_slos'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%origin%'
  loop
    execute format('alter table public.curriculum_slos drop constraint %I', c);
  end loop;
end $$;

alter table public.curriculum_slos
  add constraint curriculum_slos_origin_check
  check (origin in ('board_slo', 'textbook_slo', 'textbook_topic'));

comment on column public.curriculum_slos.origin is
  'board_slo: published by the board with its own code. textbook_slo: printed verbatim in the board''s official textbook, code minted by us. textbook_topic: a textbook topic or lesson standing in where a chapter prints no outcomes.';

comment on table public.curriculum_slos is
  'Learning outcomes every generated note and question points back at. FBISE: the board''s SLOs from the SSC Assessment Frameworks. Punjab: the SLOs printed in the PCTB 2023 textbooks.';

-- Outcomes follow the same wall as everything else: a student reads their own
-- board's. Nothing in either app reads this table today, which is exactly when
-- a policy is cheapest to get right.
drop policy if exists "read slos" on public.curriculum_slos;
create policy "read own board slos" on public.curriculum_slos
  for select to authenticated
  using (board = public.current_board());
