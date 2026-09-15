-- The admin overview's three fourteen-day charts, in Karachi days.
--
-- 0032 bucketed by current_date and ::date, which on this database are UTC.
-- A Karachi day starts at 19:00 UTC the evening before, so signups and
-- payments between midnight and five in the morning landed on the previous
-- day's bar, and for those five hours "today" on the chart was still
-- yesterday: the studied bar, whose active_days are already Karachi days, had
-- nowhere to put today's students. Every bucket is now a Karachi day, the day
-- the students and the admin live in. Same signature and columns as 0032.

create or replace function public.admin_daily_stats(days int default 14)
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
declare
  today date := (now() at time zone 'Asia/Karachi')::date;
  since timestamptz;
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'not allowed';
  end if;

  -- Bounded, so a caller cannot ask for ten years of buckets in one request.
  days := greatest(1, least(coalesce(days, 14), 90));
  -- Midnight in Karachi on the first day shown, as an instant.
  since := ((today - (days - 1))::timestamp at time zone 'Asia/Karachi');

  return query
  with span as (
    select generate_series(today - (days - 1), today, interval '1 day')::date as d
  )
  select
    span.d,
    coalesce(u.n, 0)::int,
    coalesce(p.total, 0)::int,
    coalesce(a.n, 0)::int
  from span
  left join (
    select (au.created_at at time zone 'Asia/Karachi')::date as d, count(*)::int as n
    from auth.users au
    where au.created_at >= since
    group by 1
  ) u on u.d = span.d
  left join (
    select (pay.at at time zone 'Asia/Karachi')::date as d, sum(pay.amount)::int as total
    from public.payments pay
    where pay.status = 'paid' and pay.at >= since
    group by 1
  ) p on p.d = span.d
  left join (
    -- Distinct students, not rows. active_days.day is already a Karachi day.
    select ad.day as d, count(distinct ad.user_id)::int as n
    from public.active_days ad
    where ad.day >= today - (days - 1)
    group by ad.day
  ) a on a.d = span.d
  order by span.d;
end;
$$;

revoke all on function public.admin_daily_stats(int) from public, anon;
grant execute on function public.admin_daily_stats(int) to authenticated;
