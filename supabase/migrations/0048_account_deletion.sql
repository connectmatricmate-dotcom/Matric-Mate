-- Students can delete their own account from either app (POST /api/account/delete).
--
-- Until now deletion was an email to the team and a person running a script,
-- with nothing in the product to do it and no record that it was done. The
-- route deletes the login account with the server key; every table that
-- belongs to the student goes with it by cascade. Two things need saying
-- before that can be switched on:
--
-- 1. A teacher's commission is computed from their students' payments, found
--    through profiles.referred_by. When a student who paid is deleted, the
--    payment rows stay (the accounts need them; user_id becomes null) but the
--    profile that tied them to the teacher is gone, and the teacher's earned
--    total would drop by what that student paid. So the teacher is written on
--    the payment itself, at the time it is made, and backfilled here.
--
-- 2. A deletion leaves no trace by design, which also means nobody could say
--    it happened. account_deletions keeps the fact, the date and whether the
--    account had paid, and nothing that identifies the student.

alter table public.payments
  add column if not exists referred_by uuid references auth.users (id) on delete set null;

update public.payments p
   set referred_by = pr.referred_by
  from public.profiles pr
 where pr.id = p.user_id
   and p.referred_by is null
   and pr.referred_by is not null;

create or replace function public.payment_referrer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.referred_by is null and new.user_id is not null then
    select pr.referred_by into new.referred_by from public.profiles pr where pr.id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists payment_referrer on public.payments;
create trigger payment_referrer
  before insert on public.payments
  for each row execute function public.payment_referrer();

create index if not exists payments_referred_by_idx on public.payments (referred_by) where referred_by is not null;

create table if not exists public.account_deletions (
  id uuid primary key default gen_random_uuid(),
  deleted_at timestamptz not null default now(),
  had_paid boolean not null default false,
  referred boolean not null default false,
  via text not null check (via in ('app', 'web', 'admin'))
);

alter table public.account_deletions enable row level security;
-- No policies: written and read with the server key only.

comment on table public.account_deletions is
  'One row per account deleted by its owner (or by the admin on request). No personal data: the point is to be able to say deletions happen, not who.';
comment on column public.payments.referred_by is
  'The teacher this payment earns a commission for, copied from the payer''s profile when the payment is made, so it survives the student deleting their account.';
