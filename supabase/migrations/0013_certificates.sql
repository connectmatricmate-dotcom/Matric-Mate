-- Teacher verifications: the client's trust feature. Teachers review the
-- study material and issue a certificate (a picture); the apps show the
-- roster so students and parents can see real names behind the content.
--
-- Rows are written by the team through Studio with the service key; the
-- apps only read. Certificates are trust material, so any signed-in user
-- can see them, no plan required.

create table if not exists public.certificates (
  id         uuid primary key default gen_random_uuid(),
  teacher    text not null,
  -- One line under the name: role and school, e.g. "Physics · Govt. Model School, Islamabad"
  title      text,
  -- A short paragraph about the teacher, shown on the detail view.
  bio        text,
  -- Which subject they verified, when the certificate is subject-specific.
  subject_id text,
  -- The certificate picture (PNG/JPG), served from storage or any URL.
  image_url  text not null,
  issued_on  date,
  -- Display order on the roster; lower first.
  position   int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.certificates enable row level security;

create policy "read certificates" on public.certificates
  for select to authenticated
  using (true);

create index if not exists certificates_position_idx on public.certificates (position, issued_on desc);
