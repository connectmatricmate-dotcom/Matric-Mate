-- A student's identity at Safepay.
--
-- Safepay's own docs warn against creating a second customer for someone who
-- already exists: saved payment methods and transaction history end up split
-- across two records and reconciliation becomes guesswork. So the id is stored
-- once, here, and reused for every payment that student ever makes.
--
-- Nullable because it is created lazily, at first checkout. Most students never
-- reach one, and minting a Safepay customer for every sign-up would fill the
-- merchant account with people who never paid.

alter table public.profiles
  add column if not exists safepay_customer_id text;

comment on column public.profiles.safepay_customer_id is
  'Safepay customer token (cus_…), created at first checkout and reused after.';

-- Reconciliation goes the other way too: given a customer token from a Safepay
-- report, find the student. Unique so a token can never map to two of them.
create unique index if not exists profiles_safepay_customer_idx
  on public.profiles (safepay_customer_id)
  where safepay_customer_id is not null;
