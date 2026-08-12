-- Onboarding choices follow the account, not the device.
--
-- Class, board, group and picked subjects lived only in AsyncStorage, so a
-- reinstall or a second phone marched a paying student back through the
-- class-and-subjects flow as if they were new, and then, because the flow was
-- built for strangers, ended by asking them to create the account they were
-- already signed in to. One jsonb column, because the shape is owned by the
-- app and changes with it; the server only needs to hand it back.

alter table public.profiles
  add column if not exists onboarding jsonb;
