-- The paywall becomes real: content is served only to paying accounts.
--
-- The client's decision after M2: no free tier at all, every user pays.
-- Until now RLS said "any signed-in student reads published content" and the
-- premium lock lived in the apps' UI, which was fine while chapter one was
-- free anyway. Under paid-only that gap is the whole product: anyone with a
-- free account's auth token could read the full syllabus straight off the
-- REST API. So the entitlement check moves into the database, where no
-- client can decline to run it.
--
-- What stays readable to every signed-in account, deliberately:
--   subjects, chapters, curriculum_slos
-- That is the shelf, not the goods: titles, counts, board outcome codes. The
-- apps show it to unpaid users as the "what's inside" pitch, and it contains
-- nothing a textbook's table of contents does not.
--
-- What now requires an active plan:
--   chapter_sections, mcqs, flashcards, short_questions, blanks, audio_tracks

-- One place to define "has a plan", used by every policy below and, later,
-- by the AI routes. SECURITY DEFINER so the lookup ignores entitlements' own
-- row-level security; STABLE so the planner runs it once per query, not once
-- per row.
create or replace function public.has_active_plan()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.entitlements e
    where e.user_id = (select auth.uid())
      and e.active
      and (e.valid_till is null or e.valid_till > now())
  );
$$;

grant execute on function public.has_active_plan() to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'chapter_sections', 'mcqs', 'flashcards', 'short_questions', 'blanks', 'audio_tracks'
  ]
  loop
    execute format('drop policy if exists "read published" on public.%I', t);
    execute format(
      'create policy "read published, plan required" on public.%I
         for select to authenticated
         using (review_status = ''published'' and public.has_active_plan())', t);
  end loop;
end $$;

-- The free sample chapter dies with the free tier. Every chapter is premium,
-- and the flag stays only because the apps read it; it no longer varies.
update public.chapters set premium = true where premium = false;
