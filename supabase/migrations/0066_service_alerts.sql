-- Problems with an outside service that only the admin can fix.
--
-- When the Anthropic credit ran out on 11 Sep, every AI screen said
-- "something went wrong, try again" and nothing told the admin why. The AI
-- routes now record a failure they recognise as the account's (credit or
-- billing) here, one row per kind, counting how often and since when; the
-- admin overview shows any seen in the last day.

create table if not exists public.service_alerts (
  kind text primary key,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  count integer not null default 1,
  detail text
);
alter table public.service_alerts enable row level security;
-- No policies: written and read with the server key only.

create or replace function public.note_service_alert(p_kind text, p_detail text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.service_alerts as a (kind, detail)
  values (p_kind, left(p_detail, 500))
  on conflict (kind) do update
    set last_at = now(),
        count = case when a.last_at < now() - interval '1 day' then 1 else a.count + 1 end,
        first_at = case when a.last_at < now() - interval '1 day' then now() else a.first_at end,
        detail = left(excluded.detail, 500);
$$;
revoke all on function public.note_service_alert(text, text) from public, anon, authenticated;
grant execute on function public.note_service_alert(text, text) to service_role;
