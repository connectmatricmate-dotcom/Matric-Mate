-- Every student, with the few facts the admin panel shows, in one query.
--
-- The panel needs an email address next to each student, and email lives in
-- auth.users, which PostgREST will not join to. The alternative was paging the
-- auth admin API and matching in memory: three round trips for a hundred
-- students, and a list that silently stops being complete at whatever page
-- size somebody picked.
--
-- Security definer because it reads auth.users, and gated on the caller
-- actually being an administrator. It is meant to be called with the admin's
-- OWN session, not the service key: auth.uid() is null for the service role,
-- so this refuses there, which is the safe direction.

create or replace function public.admin_student_list()
returns table (
  id uuid,
  name text,
  email text,
  phone text,
  joined timestamptz,
  plan text,
  active boolean,
  valid_till timestamptz,
  paid_total integer,
  teacher text
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

  return query
  select
    p.id,
    coalesce(nullif(trim(p.name), ''), split_part(u.email, '@', 1)) as name,
    u.email::text,
    p.phone,
    u.created_at as joined,
    e.plan,
    -- The `active` column is written by the payment path and nothing sweeps it
    -- when a plan runs out, so expiry is checked here rather than trusted.
    coalesce(e.active and e.valid_till > now(), false) as active,
    e.valid_till,
    coalesce(pay.total, 0)::int as paid_total,
    t.full_name as teacher
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.entitlements e on e.user_id = p.id
  left join public.affiliates t on t.user_id = p.referred_by
  left join lateral (
    select sum(amount)::int as total
    from public.payments
    where user_id = p.id and status = 'paid'
  ) pay on true
  where coalesce(p.role, 'student') = 'student'
  order by u.created_at desc;
end;
$$;

revoke all on function public.admin_student_list() from public, anon;
grant execute on function public.admin_student_list() to authenticated;
