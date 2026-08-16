-- A correction window on the class cooldown.
--
-- The seven day cooldown exists so one subscription cannot be shared by a
-- Class 9 and a Class 10 student. It was also catching honest mistakes: the
-- onboarding flow writes the grade as soon as the class is picked, so a
-- student who chose Class 10, walked two steps forward and then went back to
-- Class 9 had their correction rejected by the trigger. The write is fire and
-- forget, so the app kept the new choice locally while the server kept the
-- old one, and the next hydration flipped them back and wiped their progress.
--
-- So: a change made within half an hour of the previous one is the same
-- decision being corrected, and is always allowed. After that the class is
-- settled for a week, which is what the sharing wall needs.

create or replace function public.enforce_grade_cooldown()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.grade is distinct from old.grade then
    if old.grade_changed_at is not null
       and old.grade_changed_at > now() - interval '7 days'
       and old.grade_changed_at <= now() - interval '30 minutes' then
      raise exception 'grade_cooldown: class was changed on %, next change allowed after %',
        old.grade_changed_at, old.grade_changed_at + interval '7 days';
    end if;
    -- Only the first change in a correction window starts the clock, or a
    -- student could hold the window open by flipping back and forth.
    if old.grade_changed_at is null or old.grade_changed_at <= now() - interval '30 minutes' then
      new.grade_changed_at := now();
    end if;
  end if;
  return new;
end;
$$;
