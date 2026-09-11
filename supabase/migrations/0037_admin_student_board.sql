-- The admin's student list says which class and board each student is on.
--
-- With Punjab live beside FBISE, "who is this student" is not answered by a
-- name and an email: a Punjab Class 10 account and an FBISE Class 9 one need
-- different help, and the admin grants plans from this table. Same function,
-- two more columns. Postgres cannot change a function's result columns in
-- place, so it is dropped and made again, with the same guard and grants.

drop function if exists public.admin_student_list();

create function public.admin_student_list()
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
  teacher text,
  grade smallint,
  board text
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
    t.full_name as teacher,
    p.grade::smallint,
    p.board
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
