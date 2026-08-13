-- The tutor becomes real: persistent chat and a review gate for AI questions.
--
-- Messages used to live only in the phone's AsyncStorage, so a conversation
-- died with the device and the website knew nothing about it. Threads and
-- messages now live here, readable by their owner from both apps. The
-- assistant's rows are written by the server route with the service key;
-- students can only write their own user-role rows, so nobody can forge a
-- tutor answer into their history.

create table if not exists public.chat_threads (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  title         text not null,
  context_label text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists chat_threads_user_idx on public.chat_threads (user_id, updated_at desc);

create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.chat_threads on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  at         timestamptz not null default now()
);

create index if not exists chat_messages_thread_idx on public.chat_messages (thread_id, at);
-- The rate limiter counts a student's recent user-role messages.
create index if not exists chat_messages_user_at_idx on public.chat_messages (user_id, at desc);

alter table public.chat_threads  enable row level security;
alter table public.chat_messages enable row level security;

create policy "own threads" on public.chat_threads
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Read everything in your threads; write only your own user-role messages.
-- Assistant rows arrive via the service key, which bypasses RLS.
create policy "read own messages" on public.chat_messages
  for select using ((select auth.uid()) = user_id);
create policy "write own user messages" on public.chat_messages
  for insert with check ((select auth.uid()) = user_id and role = 'user');

-- AI-drafted questions land here as drafts, never straight into the bank.
-- The mcqs table students draw from stays human-curated: a row moves there
-- only after a person approves it (Supabase Studio until the admin CMS in
-- M7). This is the review gate the build plan requires.
create table if not exists public.generated_mcqs (
  id            uuid primary key default gen_random_uuid(),
  subject_id    text,
  topic         text not null,
  medium        public.content_medium not null default 'en',
  q             text not null,
  options       jsonb not null,
  answer        smallint not null,
  explanation   text,
  difficulty    text,
  review_status public.review_status not null default 'review',
  created_at    timestamptz not null default now()
);

alter table public.generated_mcqs enable row level security;

-- Students may read approved rows only; drafting happens with the service key.
create policy "read approved" on public.generated_mcqs
  for select to authenticated
  using (review_status = 'published' and public.has_active_plan());
