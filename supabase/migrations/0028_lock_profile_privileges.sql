-- A student could make themselves an administrator. Introduced by 0026.
--
-- `profiles` has had one policy since the first migration: "own profile", FOR
-- ALL, USING auth.uid() = id. That was exactly right while every column on the
-- row was the student's own business. 0026 added two columns that are not:
--
--   role         which of the three areas the account belongs in
--   referred_by  which teacher earns a share of what this student pays
--
-- and the existing policy let the account holder write both. Verified against
-- production with a throwaway account, since removed: one PATCH to
-- /rest/v1/profiles with {"role":"admin"} returned 200 and the row said admin
-- afterwards. The email allowlist in the web app was the only thing left
-- standing, and that check passes everybody when ADMIN_EMAILS is unset, which
-- is the default.
--
-- `referred_by` is the quieter half and is worth as much: writing another
-- teacher's id into your own profile invents a commission out of nothing.
--
-- Two locks, because the first one is a grant and grants get restored by
-- accident.

-- 1. Take away the ability to write those two columns at all. Postgres keeps
--    the table-level UPDATE for every other column, so a student can still
--    change their name, their settings and their class.
revoke update (role, referred_by, referred_at) on public.profiles from anon, authenticated;

-- 2. And refuse the write even if the grant comes back.
--
--    `auth.uid()` is null for the service role and for a direct postgres
--    connection, which is how the admin panel sets a teacher's role and how
--    scripts/make-admin.mjs works. It is non-null for anybody arriving with a
--    user's token, which is exactly the case to stop.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;  -- a server job, acting with no user session
  end if;

  if new.role is distinct from old.role then
    raise exception 'profiles.role cannot be changed from a client session';
  end if;
  if new.referred_by is distinct from old.referred_by then
    raise exception 'profiles.referred_by cannot be changed from a client session';
  end if;
  if new.referred_at is distinct from old.referred_at then
    raise exception 'profiles.referred_at cannot be changed from a client session';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_privileges on public.profiles;
create trigger guard_profile_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

comment on function public.guard_profile_privileges() is
  'Stops an account holder writing role, referred_by or referred_at on their own profile. One of those is an admin promotion and one of them is somebody else''s commission.';
