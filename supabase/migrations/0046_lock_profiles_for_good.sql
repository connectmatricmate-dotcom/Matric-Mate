-- A student could still make themselves an administrator. 0028 was not enough.
--
-- 0028 revoked UPDATE on (role, referred_by, referred_at) and added a trigger
-- refusing changes to them. Both were real, and both were beside the point:
--
--   1. A column REVOKE does nothing while the table-level UPDATE grant stands.
--      Postgres checks the table grant first and never looks further.
--   2. The "own profile" policy is FOR ALL, so the holder can DELETE their own
--      row and INSERT it again with role = 'admin'. The guard trigger was
--      BEFORE UPDATE only, and an insert is not an update.
--
-- Found in the 15 Sep audit with a throwaway account: delete, re-insert as
-- admin, and admin_student_list() answered with every student's email, phone,
-- school and payments. The website's admin pages stayed shut (they also need
-- the address in ADMIN_EMAILS), but the database functions behind them trust
-- the role alone. No profile in production was created later than its login
-- account, so nobody had used it.
--
-- The same table grant let a student write the columns the server trusts:
-- grade_changed_at (clear it and the 7-day class cooldown is gone),
-- safepay_customer_id, xp, welcomed_at and tip_sent_on.
--
-- Now:
--   * profiles can be read and updated by their holder, never inserted or
--     deleted (sign-up inserts through handle_new_user, deletion is the auth
--     user's cascade, both without a user session);
--   * UPDATE is granted only on the columns the two apps actually write:
--     name, school, settings, onboarding and grade (board follows onboarding
--     by trigger, grade_changed_at by trigger);
--   * the guard runs on insert as well, in case a grant is ever restored.

drop policy if exists "own profile" on public.profiles;
drop policy if exists "read own profile" on public.profiles;
drop policy if exists "update own profile" on public.profiles;

create policy "read own profile" on public.profiles
  for select using ((select auth.uid()) = id);

create policy "update own profile" on public.profiles
  for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

revoke insert, delete, truncate, references, trigger on public.profiles from anon, authenticated;
revoke update on public.profiles from anon, authenticated;
grant update (name, school, settings, onboarding, grade) on public.profiles to authenticated;

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;  -- sign-up (handle_new_user), a server job, or a script
  end if;

  if tg_op = 'INSERT' then
    raise exception 'profiles are created at sign-up, not from a client session';
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
  before insert or update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- Tutor history is written by the tutor route with the service key, both
-- sides. The client policy that let a student add "user" rows was never used
-- by either app, and it let a student plant text (of any length, dated any
-- time) that the tutor then read back as their own earlier questions.
drop policy if exists "write own user messages" on public.chat_messages;
alter table public.chat_messages drop constraint if exists chat_messages_content_len;
alter table public.chat_messages add constraint chat_messages_content_len check (char_length(content) <= 60000);

-- A report is filed as new. Filing one already marked seen hid it from the
-- admin's "new" count.
drop policy if exists "report as yourself" on public.ai_reports;
create policy "report as yourself" on public.ai_reports
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'new');
