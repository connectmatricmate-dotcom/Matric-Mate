-- 0031 threw on every call: `column reference "day" is ambiguous` (42702).
--
-- In a plpgsql function, the names in RETURNS TABLE become variables in scope
-- for the whole body, so the output column `day` collided with `active_days.day`
-- wherever that column was referenced without a table qualifier. The function
-- was created successfully and failed only when run, and because the caller
-- treats a failed chart as an empty series, the overview drew three empty
-- boxes rather than an error.
--
-- Two belts. The output columns are renamed to something no table has, and
-- every column reference in the body is qualified.

drop function if exists public.admin_daily_stats(int);

create function public.admin_daily_stats(days int default 14)
returns table (
  bucket date,
  signup_count int,
  revenue_total int,
  studied_count int
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'not allowed';
  end if;

  -- Bounded, so a caller cannot ask for ten years of buckets in one request.
  days := greatest(1, least(coalesce(days, 14), 90));

  return query
  with span as (
    select generate_series((current_date - (days - 1)), current_date, interval '1 day')::date as d
  )
  select
    span.d,
    coalesce(u.n, 0)::int,
    coalesce(p.total, 0)::int,
    coalesce(a.n, 0)::int
  from span
  left join (
    select au.created_at::date as d, count(*)::int as n
    from auth.users au
    where au.created_at >= current_date - (days - 1)
    group by au.created_at::date
  ) u on u.d = span.d
  left join (
    select pay.at::date as d, sum(pay.amount)::int as total
    from public.payments pay
    where pay.status = 'paid' and pay.at >= current_date - (days - 1)
    group by pay.at::date
  ) p on p.d = span.d
  left join (
    -- Distinct students, not rows: reading five chapters in a day is one
    -- active student, and counting rows would call them five.
    select ad.day as d, count(distinct ad.user_id)::int as n
    from public.active_days ad
    where ad.day >= current_date - (days - 1)
    group by ad.day
  ) a on a.d = span.d
  order by span.d;
end;
$$;

revoke all on function public.admin_daily_stats(int) from public, anon;
grant execute on function public.admin_daily_stats(int) to authenticated;
