-- Make "Thanks, noted" true.
--
-- Both apps show a thumbs up and thumbs down under every tutor answer. Both
-- latch, and both toast "Thanks, noted" or "Noted, we'll improve this answer".
-- Neither recorded anything anywhere: no request, no row. The app was telling
-- students their feedback had been captured when nothing had been.
--
-- It is worth capturing on its own merits. A thumbs down on a specific answer
-- is the cheapest signal we have for finding where the tutor is weak, and it
-- is the only one a student volunteers.

create table if not exists public.tutor_feedback (
  message_id uuid not null references public.chat_messages on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  rating     text not null check (rating in ('up', 'down')),
  at         timestamptz not null default now(),
  -- One rating per student per answer, and changing your mind overwrites
  -- rather than stacking a second row.
  primary key (message_id, user_id)
);

create index if not exists tutor_feedback_rating_idx on public.tutor_feedback (rating, at desc);

alter table public.tutor_feedback enable row level security;

-- A student may rate their own answers and see their own ratings. Nobody reads
-- anyone else's; the useful reading is done server side with the admin client.
create policy "rate own answers" on public.tutor_feedback
  for insert with check ((select auth.uid()) = user_id);

create policy "change own rating" on public.tutor_feedback
  for update using ((select auth.uid()) = user_id);

create policy "read own ratings" on public.tutor_feedback
  for select using ((select auth.uid()) = user_id);
