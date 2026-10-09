-- A student asking for Premium while plans are switched on by hand.
--
-- No payment gateway is live. The student presses the Premium button, sees the
-- accounts to send the money to and the WhatsApp number for the screenshot,
-- and the admin switches the plan on. This is the record of that ask: the
-- admin is emailed the moment it arrives, sees it at the top of Follow up, and
-- giving the plan closes it.
--
-- One open request per student (the partial unique index): pressing the button
-- again returns the same row rather than a second email to the admin.

create table if not exists public.plan_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'monthly' check (plan in ('monthly')),
  status text not null default 'pending' check (status in ('pending', 'done', 'dismissed')),
  via text not null default 'web' check (via in ('web', 'app')),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);

create unique index if not exists plan_requests_one_open
  on public.plan_requests (user_id) where status = 'pending';
create index if not exists plan_requests_pending_at
  on public.plan_requests (created_at desc) where status = 'pending';

alter table public.plan_requests enable row level security;
-- No policies: written and read with the server key only, through
-- /api/plan-request (the student's own) and the admin pages.
