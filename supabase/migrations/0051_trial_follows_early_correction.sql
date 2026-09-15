-- A trial is held to the board and class it was started for (0050), but a
-- student who notices within half an hour that they picked the wrong board or
-- class and corrects it keeps their trial on the corrected one. The same
-- thirty minutes the class cooldown already allows for a correction (0014).

create or replace function public.trial_follows_correction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.board is distinct from old.board or new.grade is distinct from old.grade then
    update public.entitlements
       set trial_board = new.board, trial_grade = new.grade
     where user_id = new.id
       and plan = 'trial'
       and trial_used_at > now() - interval '30 minutes';
  end if;
  return new;
end;
$$;

drop trigger if exists trial_follows_correction on public.profiles;
-- On every update, not "of board, grade": board follows onboarding through a
-- BEFORE trigger, and a column set that way does not count as updated.
create trigger trial_follows_correction
  after update on public.profiles
  for each row execute function public.trial_follows_correction();
