-- At most twenty reported AI answers per student per Karachi day.
--
-- Reports are the channel Google Play requires, so filing one must always be
-- possible, but nothing stopped one account from filing thousands and burying
-- the admin's list (and the "new" count on it) under them. Twenty a day is far
-- beyond anything a real student sends. A trigger rather than the insert
-- policy: a student cannot read ai_reports, so a count inside the policy would
-- always see none. The function runs as its owner and can count.

create or replace function public.ai_report_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  -- Two reports sent at the same instant are counted one after the other.
  perform pg_advisory_xact_lock(hashtextextended('ai-report:' || new.user_id::text, 0));
  select count(*) into n
    from public.ai_reports r
   where r.user_id = new.user_id
     and r.created_at >= (date_trunc('day', now() at time zone 'Asia/Karachi') at time zone 'Asia/Karachi');
  if n >= 20 then
    raise exception 'ai report limit reached for today' using errcode = 'P0001', hint = 'ai_report_limit';
  end if;
  return new;
end;
$$;

revoke all on function public.ai_report_cap() from public, anon, authenticated;

drop trigger if exists ai_report_cap on public.ai_reports;
create trigger ai_report_cap
  before insert on public.ai_reports
  for each row execute function public.ai_report_cap();

create index if not exists ai_reports_user_day_idx on public.ai_reports (user_id, created_at desc);
