-- A chapter's identity now includes its grade.
--
-- The unique (subject_id, number) constraint dates from the one-class world:
-- Physics chapter 3 could only ever mean one row. With SSC-II seeded there is
-- a chapter 3 per grade, so the natural key grows. Same shape any future
-- board column would follow.

alter table public.chapters drop constraint if exists chapters_subject_id_number_key;
alter table public.chapters add constraint chapters_subject_grade_number_key
  unique (subject_id, grade, number);
