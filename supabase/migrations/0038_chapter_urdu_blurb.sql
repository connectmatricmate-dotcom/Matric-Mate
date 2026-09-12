-- A chapter's one-line description, in Urdu.
--
-- `blurb` has only ever been written in English, so a student using the app in
-- Urdu read every chapter list and chapter page in Urdu with an English line
-- under each title. The apps show this column in the Urdu interface and fall
-- back to `blurb` where it is still empty.

alter table public.chapters add column if not exists urdu_blurb text;

comment on column public.chapters.urdu_blurb is
  'One-line chapter description in Urdu, shown in the Urdu interface. Falls back to blurb when null.';
