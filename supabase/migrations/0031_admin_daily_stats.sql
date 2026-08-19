-- Signups, payments and study activity per day, for the admin overview chart.
--
-- Grouped in the database rather than in the app. The alternative is paging
-- every profile, payment and active_days row into memory and bucketing them by
-- hand on each page view, which is three growing tables read in full to draw
-- fourteen bars.
--
-- Same gate as admin_student_list: the caller's own session must be an
-- administrator, so this refuses the service role too.

create or replace function public.admin_daily_stats(days int default 14)
returns table (
  day date,
  signups int,
  revenue int,
  studied int
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
    select generate_series((current_date - (days - 1)), current_date, interval '1 day')::date as day
  )
  select
    s.day,
    coalesce(u.n, 0)::int as signups,
    coalesce(p.total, 0)::int as revenue,
    coalesce(a.n, 0)::int as studied
  from span s
  left join (
    select created_at::date as day, count(*)::int as n
    from auth.users
    where created_at >= current_date - (days - 1)
    group by 1
  ) u on u.day = s.day
  left join (
    select at::date as day, sum(amount)::int as total
    from public.payments
    where status = 'paid' and at >= current_date - (days - 1)
    group by 1
  ) p on p.day = s.day
  left join (
    -- Distinct students, not rows: reading five chapters in a day is one
    -- active student, and counting rows would call them five.
    select day, count(distinct user_id)::int as n
    from public.active_days
    where day >= current_date - (days - 1)
    group by 1
  ) a on a.day = s.day
  order by s.day;
end;
$$;

revoke all on function public.admin_daily_stats(int) from public, anon;
grant execute on function public.admin_daily_stats(int) to authenticated;
