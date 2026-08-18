-- A phone is a device, not an account. The row that says where to send a push
-- was keyed on the device token but owned by whoever registered it first, and
-- row level security then made that ownership permanent.
--
-- What happened in practice: a student signs out and a second account signs in
-- on the same phone. The FCM token does not change (only a reinstall changes
-- it), so the app upserts the same row with a new user_id, and Postgres refuses
-- with 42501, "new row violates row-level security policy (USING expression)".
-- The app never looked at the result, so nothing said so. Two consequences,
-- and the quiet one is worse:
--
--   1. the new account never receives a push, because it owns no device
--   2. the previous account's notifications keep arriving on a phone that
--      somebody else is now signed in to
--
-- The policy is right: a student must not be able to write a row against
-- another student's id. The gap is that claiming a device is not that. It is
-- one privileged operation, so it gets one privileged function.

-- Take ownership of this device for the caller, whoever held it before.
--
-- security definer so it can delete the previous owner's row, and the ONLY
-- thing it will ever write is auth.uid(): the caller cannot name a user, so
-- there is nothing here to abuse. Deleting rather than reassigning keeps
-- created_at honest about when this pairing began.
create or replace function public.claim_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'claim_push_token: not authenticated';
  end if;
  if p_token is null or length(p_token) < 16 then
    raise exception 'claim_push_token: implausible token';
  end if;

  delete from public.push_tokens where token = p_token;

  insert into public.push_tokens (token, user_id, platform, last_seen_at)
  values (p_token, uid, coalesce(nullif(p_platform, ''), 'android'), now());
end;
$$;

comment on function public.claim_push_token(text, text) is
  'Bind this device token to the calling student, releasing any previous owner. The only way an app should write push_tokens.';

-- Hand the device back on sign-out, so the next student on this phone does not
-- inherit the last student's notifications. Called while the session is
-- still alive, which is why it can be scoped to the caller's own rows.
create or replace function public.release_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;
  delete from public.push_tokens where token = p_token and user_id = uid;
end;
$$;

comment on function public.release_push_token(text) is
  'Forget this device for the calling student. Called on sign-out.';

revoke all on function public.claim_push_token(text, text) from public, anon;
revoke all on function public.release_push_token(text) from public, anon;
grant execute on function public.claim_push_token(text, text) to authenticated;
grant execute on function public.release_push_token(text) to authenticated;
