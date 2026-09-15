-- Size limits on what a student's apps write about their own studying.
--
-- These tables are written straight from the apps (row level security keeps
-- each student to their own rows), and nothing bounded a value's length: a
-- hand-made request could fill a topic with a megabyte that every progress
-- screen, the report card PDF and the teacher's view would then read. The
-- limits are far above anything the apps write (the longest topic today is
-- 42 characters, the longest id 42).

alter table public.attempts drop constraint if exists attempts_sizes;
alter table public.attempts add constraint attempts_sizes check (
  char_length(coalesce(topic, '')) <= 300
  and char_length(coalesce(mcq_id, '')) <= 120
  and char_length(coalesce(chapter_id, '')) <= 60
  and char_length(coalesce(subject_id, '')) <= 20
  and char_length(coalesce(mode, '')) <= 20
);

alter table public.results drop constraint if exists results_sizes;
alter table public.results add constraint results_sizes check (
  char_length(coalesce(label, '')) <= 300
  and char_length(coalesce(chapter_id, '')) <= 60
  and char_length(coalesce(subject_id, '')) <= 20
);

alter table public.cards_known drop constraint if exists cards_known_sizes;
alter table public.cards_known add constraint cards_known_sizes check (char_length(card_id) <= 120);

alter table public.read_sections drop constraint if exists read_sections_sizes;
alter table public.read_sections add constraint read_sections_sizes check (char_length(section_id) <= 120);

alter table public.plan_done drop constraint if exists plan_done_sizes;
alter table public.plan_done add constraint plan_done_sizes check (char_length(task_id) <= 120);
