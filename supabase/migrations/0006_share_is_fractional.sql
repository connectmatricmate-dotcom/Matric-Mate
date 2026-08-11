-- exam_share has to hold a fraction of a percent.
--
-- 0005 typed it smallint on the strength of the Physics table, whose shares are
-- whole numbers. Chemistry and Biology are not: their Tables of Specification
-- give 3.7%, 6.48%, 9.25%, 15.7%. Inserting those into a smallint fails the
-- whole chapters upsert, which is how the corrected chapter lists silently
-- failed to reach the database.
--
-- Rounding to whole percents was the other option and it is the wrong one: the
-- shares are what a student uses to decide what to revise, and a subject with
-- twenty chapters has real differences hiding inside a percentage point.

alter table public.chapters
  alter column exam_share type numeric(5,2)
  using exam_share::numeric(5,2);

alter table public.chapters
  drop constraint if exists chapters_exam_share_check;

alter table public.chapters
  add constraint chapters_exam_share_check
  check (exam_share is null or (exam_share >= 0 and exam_share <= 100));
