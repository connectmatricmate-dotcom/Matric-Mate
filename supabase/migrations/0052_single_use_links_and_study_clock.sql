-- Two fixes from the 15 Sep audit.
--
-- 1. The plan reminder email's button (lib/signin-link.ts) signed the student
--    in every time it was opened, for seven days: a forwarded email, or a
--    link preview, was a week-long way into the account. Each link now
--    carries a random nonce, and /go/plans claims it here before signing
--    anyone in. The second open of the same link goes to the sign-in page.
--
-- 2. add_study_time took whatever each call said, up to 120 seconds, however
--    often it was called: two open windows (a phone and a laptop) each
--    counted the same minute, and teachers are shown this number. A call is
--    now credited no more than the time since the last one.

create table if not exists public.signin_links (
  nonce text primary key check (char_length(nonce) between 16 and 64),
  user_id uuid not null references auth.users (id) on delete cascade,
  used_at timestamptz not null default now()
);
alter table public.signin_links enable row level security;
-- No policies: the server key only.

create or replace function public.add_study_time(p_seconds integer)
returns integer
language sql
security definer
set search_path = ''
as $$
  insert into public.study_time as t (user_id, day, seconds)
  values (auth.uid(), (now() at time zone 'Asia/Karachi')::date, least(greatest(coalesce(p_seconds, 0), 0), 120))
  on conflict (user_id, day) do update
    set seconds = least(
          t.seconds + least(
            greatest(coalesce(p_seconds, 0), 0),
            120,
            -- Never more than has passed since the last call (a few seconds'
            -- grace for the clock's own timing).
            greatest(ceil(extract(epoch from (now() - coalesce(t.last_at, t.first_at, now() - interval '120 seconds'))))::int + 5, 0)
          ),
          86400),
        last_at = now()
  returning seconds;
$$;
