-- Two money writes made safe to repeat and impossible to half-finish.
--
-- 1. settle_payment. Marking a payment paid and switching the plan on were two
--    separate writes from the website, and neither was checked. A failure
--    between them left a payment counted as revenue (and as a teacher's
--    commission) for a plan that never started, the admin was told it worked,
--    and a retry found the payment already paid and granted nothing. Now both
--    happen in one transaction or neither does, and the caller is told which.
--
-- 2. record_manual_payment. A plan given by hand from the admin panel is
--    written as a payment first. Two presses of "Give Premium" wrote two rows:
--    two months for the student, double the revenue and double the teacher's
--    commission. The same plan for the same student within two minutes is now
--    one grant, decided under a lock so two presses at the same instant cannot
--    both get through.
--
-- Server only: both run with the service key, from lib/payments.ts and the
-- admin actions. Nobody signed in may call them.

create or replace function public.settle_payment(
  p_tracker text,
  p_reference text,
  p_raw jsonb,
  p_plan text,
  p_valid_till timestamptz,
  p_seen_valid_till timestamptz,
  p_source text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  pay record;
  cur timestamptz;
  had boolean := false;
begin
  -- The row is locked, so a webhook and a returning payer settling the same
  -- payment at once queue here, and the second one finds it already paid.
  select p.id, p.user_id, p.status into pay
    from public.payments p
   where p.tracker = p_tracker
   for update;
  if not found then
    return jsonb_build_object('outcome', 'unknown');
  end if;
  if pay.status = 'paid' then
    return jsonb_build_object('outcome', 'already', 'user_id', pay.user_id);
  end if;

  if pay.user_id is not null then
    select e.valid_till into cur
      from public.entitlements e
     where e.user_id = pay.user_id
       for update;
    had := found;
    -- The new end date was worked out from the end date the caller read. If
    -- that moved in the meantime (another payment settled first), nothing is
    -- written and the caller works it out again from the new one.
    if (had and cur is distinct from p_seen_valid_till) or (not had and p_seen_valid_till is not null) then
      return jsonb_build_object('outcome', 'stale', 'user_id', pay.user_id);
    end if;
  end if;

  update public.payments
     set status = 'paid', reference = p_reference, raw = p_raw
   where id = pay.id;

  if pay.user_id is not null then
    -- trial_subject cleared: a paid plan opens every subject. trial_used_at is
    -- left alone, so a trial that was used stays used.
    insert into public.entitlements as e (user_id, active, plan, valid_till, trial_subject, source, updated_at)
    values (pay.user_id, true, p_plan, p_valid_till, null, p_source, now())
    on conflict (user_id) do update
      set active = true,
          plan = excluded.plan,
          valid_till = excluded.valid_till,
          trial_subject = null,
          source = excluded.source,
          updated_at = now();
  end if;

  return jsonb_build_object('outcome', 'granted', 'user_id', pay.user_id, 'valid_till', p_valid_till);
end;
$$;

revoke all on function public.settle_payment(text, text, jsonb, text, timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.settle_payment(text, text, jsonb, text, timestamptz, timestamptz, text) to service_role;

create or replace function public.record_manual_payment(
  p_user uuid,
  p_plan text,
  p_amount integer,
  p_tracker text,
  p_order text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent record;
begin
  -- One manual grant at a time per student. A second press waits here until
  -- the first has committed, and then sees its row below.
  perform pg_advisory_xact_lock(hashtextextended('manual-grant:' || p_user::text, 0));

  select p.tracker, p.status, p.at into recent
    from public.payments p
   where p.user_id = p_user
     and p.plan = p_plan
     and p.tracker like 'MANUAL-%'
     and p.status in ('pending', 'paid')
     and p.at > now() - interval '2 minutes'
   order by p.at desc
   limit 1;

  if found and recent.status = 'paid' then
    -- Already given a moment ago: refuse rather than give it twice.
    return jsonb_build_object('state', 'done', 'at', recent.at);
  end if;
  if found then
    -- Written but never settled (the first press failed half way, or is
    -- settling right now). Hand it back, so the retry settles that row
    -- instead of adding a second one.
    return jsonb_build_object('state', 'pending', 'tracker', recent.tracker);
  end if;

  insert into public.payments (user_id, tracker, order_id, plan, amount, currency, status)
  values (p_user, p_tracker, p_order, p_plan, p_amount, 'PKR', 'pending');
  return jsonb_build_object('state', 'new', 'tracker', p_tracker);
end;
$$;

revoke all on function public.record_manual_payment(uuid, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.record_manual_payment(uuid, text, integer, text, text) to service_role;

comment on function public.settle_payment(text, text, jsonb, text, timestamptz, timestamptz, text) is
  'Marks a payment paid and switches its plan on in one transaction (lib/payments.ts markPaidAndGrant). Service role only.';
comment on function public.record_manual_payment(uuid, text, integer, text, text) is
  'Writes the payment row for a plan given by hand, refusing the same plan for the same student twice within two minutes. Service role only.';
