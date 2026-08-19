-- Signup now asks for a mobile number, and the trigger stores it.
--
-- Not a field for its own sake. Safepay will not create the payer record that
-- prefills their checkout form without a phone number: their docs say it is
-- optional and their API answers 400 to omitted, empty and null alike. Without
-- that record a student types their own email out on a phone keyboard in the
-- middle of deciding whether to buy, which is the worst possible moment to add
-- a step. Every other way of prefilling was tried against the live sandbox on
-- 19 August 2026 and none of them works: a customer object inline on the
-- session, an email on the session body, an email in metadata (rejected with
-- "unsupported meta key email"), and two spellings of it on the checkout URL.
--
-- Written here rather than by the app for the same reason `referred_by` is:
-- this runs inside the transaction that creates the account, so the number
-- either arrives with the signup or not at all.
--
-- The column has taken '^\+92\d{10}$' since 0003, so the app normalises what a
-- student types (03001234567) into what the constraint wants (+923001234567)
-- before it ever gets here. Anything that does not match is dropped rather
-- than failing the signup: a student who mistypes a number should still get an
-- account.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ref_code text := nullif(trim(upper(new.raw_user_meta_data ->> 'ref')), '');
  ref_owner uuid;
  phone text := nullif(trim(new.raw_user_meta_data ->> 'phone'), '');
begin
  if ref_code is not null then
    select a.user_id into ref_owner
    from public.affiliates a
    where a.code = ref_code and a.active
    limit 1;
  end if;

  if phone is not null and phone !~ '^\+92\d{10}$' then
    phone := null;
  end if;

  insert into public.profiles (id, name, contact, phone, referred_by, referred_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.email, new.phone, ''),
    phone,
    ref_owner,
    case when ref_owner is not null then now() else null end
  );
  insert into public.entitlements (user_id) values (new.id);
  return new;
end;
$$;
