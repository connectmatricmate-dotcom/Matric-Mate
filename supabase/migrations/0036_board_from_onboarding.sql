-- The board a student picks reaches the column the database gates on.
--
-- Row level security serves chapters and everything under them by
-- profiles.board (0034), but neither app has ever written that column. The
-- board step in onboarding saves its answer inside the onboarding JSON, the
-- way both apps save every onboarding choice, and profiles.board has sat at
-- its default, 'fbise', on every account. While Punjab was greyed out that
-- cost nothing. The moment a student can pick it, they would be labelled
-- Punjab by the app and served FBISE by the database.
--
-- A trigger rather than an app change: both apps already send the answer on
-- every onboarding write, and a trigger also covers every copy of the Android
-- app already installed, which an app change reaches only as each phone
-- updates. An onboarding with no board in it (older accounts) leaves the
-- column alone.

create or replace function public.board_from_onboarding()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.onboarding ->> 'board' in ('fbise', 'punjab') then
    new.board := new.onboarding ->> 'board';
  end if;
  return new;
end;
$$;

drop trigger if exists board_from_onboarding on public.profiles;
create trigger board_from_onboarding
  before insert or update of onboarding on public.profiles
  for each row execute function public.board_from_onboarding();

comment on function public.board_from_onboarding() is
  'Keeps profiles.board, which row level security reads, equal to the board chosen in onboarding, which is what the apps write.';
