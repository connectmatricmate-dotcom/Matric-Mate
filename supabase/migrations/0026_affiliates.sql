-- The referral programme: teachers who bring students, and a share of what
-- those students pay.
--
-- Adnan recruits teachers offline and creates their accounts himself, setting
-- each one's commission by hand. The system mints a code, students who sign up
-- through it are tied to that teacher permanently, and the teacher watches it
-- on a dashboard of their own. Specced in SOW 6.14, refined by the client on
-- 19 Aug: every payment counts, not just the first; refunds take it back; and
-- payouts are recorded by hand from an admin panel.
--
-- Three shapes here and one deliberate absence. There is no `earnings` column
-- anywhere. Money is derived from `payments` every time it is read, because a
-- stored total is a number that goes wrong quietly: a refund lands, the total
-- does not move, and nobody can tell whether the row or the ledger is lying.

-- ─────────────────────────────────────────────────────────────── roles

-- Three kinds of account, one auth system. 'student' is everyone who exists
-- today, which is why it is the default and why this column is not null: an
-- account with no role would be a hole in every guard that reads it.
alter table public.profiles
  add column if not exists role text not null default 'student'
    check (role in ('student', 'affiliate', 'admin'));

comment on column public.profiles.role is
  'Which of the three areas this account belongs in: /dashboard, /affiliate or /admin. Set by an administrator, never by the account holder.';

-- Who brought this student, and when. Written by the signup trigger below, in
-- the same transaction that creates the account, so it cannot be missed by a
-- client that navigated away or forged by one that felt like it.
alter table public.profiles
  add column if not exists referred_by uuid references auth.users on delete set null;
alter table public.profiles
  add column if not exists referred_at timestamptz;

create index if not exists profiles_referred_by_idx on public.profiles (referred_by);

-- ────────────────────────────────────────────────────────── affiliates

create table if not exists public.affiliates (
  user_id        uuid primary key references auth.users on delete cascade,
  -- The code in their link. Unique, and never edited once issued: it is
  -- printed on things and sent to people, and a code that changes meaning is
  -- worse than no code.
  code           text not null unique,
  -- Adnan picks this per person. numeric, not integer: half a percent is a
  -- reasonable thing to want and a rounding argument nobody needs to have.
  commission_pct numeric(5, 2) not null check (commission_pct >= 0 and commission_pct <= 100),

  -- What he collected on paper before creating the account.
  full_name      text not null,
  phone          text,
  city           text,
  institution    text,
  note           text,

  -- How he actually pays them. Not validated here: a JazzCash number, an IBAN
  -- and a bank account number have nothing in common, and a constraint that
  -- guesses wrong blocks the one teacher who does not fit it.
  payout_method  text,
  payout_account text,
  payout_name    text,

  -- Turning a teacher off stops their link working without deleting the
  -- students they already brought, or the record of what they earned.
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users on delete set null
);

comment on table public.affiliates is
  'Teachers on the referral programme. One row per account with role = affiliate.';

-- ───────────────────────────────────────────────────────────── payouts

-- What has actually been handed over. Adnan records each transfer by hand from
-- the admin panel, and the teacher sees it on theirs, which is the whole point:
-- both sides reading the same number is what stops the argument.
create table if not exists public.affiliate_payouts (
  id           uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references auth.users on delete cascade,
  -- Whole rupees, the same unit as payments.amount. Positive only: a mistake
  -- is corrected by deleting the row, not by posting a negative one.
  amount       integer not null check (amount > 0),
  note         text,
  at           timestamptz not null default now(),
  recorded_by  uuid references auth.users on delete set null
);

create index if not exists affiliate_payouts_affiliate_idx on public.affiliate_payouts (affiliate_id, at desc);

-- ──────────────────────────────────────────────────────── code minting

-- An alphabet with no O, 0, I, 1 or 5/S in it. These codes get read aloud down
-- a phone line and written on the back of a receipt.
create or replace function public.mint_affiliate_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRTUVWXY2346789';
  candidate text;
  i integer;
begin
  for attempt in 1..20 loop
    candidate := 'MM';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    if not exists (select 1 from public.affiliates where code = candidate) then
      return candidate;
    end if;
  end loop;
  -- 28^6 is 480 million; twenty collisions in a row means something is wrong
  -- with the random source, not with our luck.
  raise exception 'mint_affiliate_code: could not find a free code';
end;
$$;

-- ───────────────────────────────────────────────────── attribution

-- The signup trigger, extended. It already seeded the profile and the
-- entitlement from the new user's metadata; now it also reads the referral
-- code the signup carried and ties the student to the teacher.
--
-- Here rather than in the app, deliberately. This runs inside the transaction
-- that creates the account, so attribution either happens with the signup or
-- not at all. An app that wrote it afterwards would lose it every time a
-- student closed the tab on the confirmation screen.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ref_code text := nullif(trim(upper(new.raw_user_meta_data ->> 'ref')), '');
  ref_owner uuid;
begin
  if ref_code is not null then
    -- Only an active teacher's code attributes. An unknown or switched-off
    -- code is not an error: the student signed up, which is what matters, and
    -- they simply belong to nobody.
    select a.user_id into ref_owner
    from public.affiliates a
    where a.code = ref_code and a.active
    limit 1;
  end if;

  insert into public.profiles (id, name, contact, referred_by, referred_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.email, new.phone, ''),
    ref_owner,
    case when ref_owner is not null then now() else null end
  );
  insert into public.entitlements (user_id) values (new.id);
  return new;
end;
$$;

-- ───────────────────────────────────────────────────── row level security

alter table public.affiliates        enable row level security;
alter table public.affiliate_payouts enable row level security;

-- A teacher reads their own row and their own payouts, and that is all any
-- signed-in account can do here. Everything else, the admin panel included,
-- goes through the service role on the server after checking the caller's
-- role: an affiliate dashboard has to read other people's profiles and
-- payments, which is exactly what RLS is there to forbid.
create policy "read own affiliate row" on public.affiliates
  for select using ((select auth.uid()) = user_id);

create policy "read own payouts" on public.affiliate_payouts
  for select using ((select auth.uid()) = affiliate_id);

-- No insert, update or delete policy on either table on purpose. Creating a
-- teacher, changing a commission and recording a payout are all administrator
-- actions, and none of them should be reachable with a student's token.
