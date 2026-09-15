-- The daily AI allowance taken before the model runs, not after.
--
-- Every AI route read the day's count when a request arrived and charged it
-- when the answer came back. Requests sent together all read the same count
-- and all passed: in the 15 Sep audit a free trial at 4 of 5 sent three at
-- once and ended the day on 7, each one a real model call on the client's
-- Anthropic key. Free trials start by themselves at sign-up, so this was
-- repeatable for the price of an email address.
--
-- reserve_ai_usage adds the cost only if the total stays within the limit,
-- in one statement, and returns the new total (null when it would not fit).
-- refund_ai_usage gives it back when no answer reached the student. Server
-- key only, like charge_ai_usage.

create or replace function public.reserve_ai_usage(p_user uuid, p_day date, p_cost integer, p_limit integer)
returns integer
language sql
set search_path = ''
as $$
  insert into public.ai_usage as u (user_id, day, used)
  select p_user, p_day, greatest(p_cost, 0)
   where greatest(p_cost, 0) <= p_limit
  on conflict (user_id, day) do update
     set used = u.used + excluded.used
   where u.used + excluded.used <= p_limit
  returning u.used;
$$;

create or replace function public.refund_ai_usage(p_user uuid, p_day date, p_cost integer)
returns integer
language sql
set search_path = ''
as $$
  update public.ai_usage
     set used = greatest(used - greatest(p_cost, 0), 0)
   where user_id = p_user and day = p_day
  returning used;
$$;

revoke all on function public.reserve_ai_usage(uuid, date, integer, integer) from public, anon, authenticated;
revoke all on function public.refund_ai_usage(uuid, date, integer) from public, anon, authenticated;
grant execute on function public.reserve_ai_usage(uuid, date, integer, integer) to service_role;
grant execute on function public.refund_ai_usage(uuid, date, integer) to service_role;
