-- What each chapter is worth in the annual paper.
--
-- From the Table of Specification the board publishes in every SSC-I Assessment
-- Framework. It is the most actionable fact we hold about a chapter: a student
-- with one evening left should revise Dynamics (22% of the paper) before Modern
-- Physics (3%), and until now nothing in the app could tell them that.
--
-- Nullable, because the ToS has only been read for Physics so far. A null means
-- "not recorded yet", never "worth nothing", so the UI must hide the badge
-- rather than render a zero.

alter table public.chapters
  add column if not exists exam_marks smallint check (exam_marks is null or exam_marks >= 0),
  add column if not exists exam_share smallint check (exam_share is null or exam_share between 0 and 100);

comment on column public.chapters.exam_marks is
  'Marks this chapter carries in the annual paper, from the board Table of Specification.';
comment on column public.chapters.exam_share is
  'Percentage of the paper, from the same table. Null means not yet recorded, not zero.';
