-- Somewhere to send a notification, other than into the app.
--
-- The inbox works now (0020), but it only reaches a student who opens the app.
-- That is fine for a streak nudge and useless for "your plan expires in three
-- days", which is the one message where missing someone costs a subscription.
--
-- Two things are needed before any of that: a place to keep the device tokens
-- push is addressed to, and a record of who agreed to be messaged on WhatsApp.

-- ─────────────────────────────────────────────────────────── push tokens

-- One row per device per student. Keyed on the token itself because that is
-- what Firebase gives us and what identifies a device: the same student on a
-- phone and a laptop is two rows, and reinstalling the app produces a new
-- token rather than reusing the old one.
create table if not exists public.push_tokens (
  token       text primary key,
  user_id     uuid not null references auth.users on delete cascade,
  -- 'android' or 'web'. Not a check constraint: a third platform should not
  -- need a migration before a device can register.
  platform    text not null,
  created_at  timestamptz not null default now(),
  -- Touched every time the app starts. Firebase rotates and expires tokens,
  -- and it will not tell us; a token nobody has refreshed in months is dead
  -- weight that we can prune on this column.
  last_seen_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- A student registers and removes their own devices. Sending is done server
-- side with the service role, which bypasses this.
create policy "own devices" on public.push_tokens
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ────────────────────────────────────────────────────── whatsapp consent

-- Meta requires explicit opt-in before a business may message someone, and
-- Pakistan's own rules on unsolicited messaging point the same way. A boolean
-- would answer "may we" but not "prove it": the timestamp is the record, and
-- null means no consent, which is also the default for every existing row.
alter table public.profiles
  add column if not exists whatsapp_opt_in timestamptz;

comment on column public.profiles.whatsapp_opt_in is
  'When the student agreed to WhatsApp messages. Null means they have not. Never set this without a real interaction: it is the evidence of consent.';

-- profiles.phone already exists (0003) and is validated as +92 followed by ten
-- digits. Nothing has ever written to it. It is a contact detail, deliberately
-- not an identifier: sign-in stays on email, so the SMS and WhatsApp providers
-- are never in the login path and can never stop somebody signing up.
comment on column public.profiles.phone is
  'Optional WhatsApp number, +92 format. A contact channel, never a login identifier.';
