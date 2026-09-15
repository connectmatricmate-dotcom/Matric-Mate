-- A second, premium voice (ElevenLabs) for the lessons where pronunciation
-- has to be exactly right: Islamiyat, the Urdu subject, and any other lesson
-- with Islamic content (the Two-Nation Theory, the Holy Prophet's life in
-- Punjab English, a Biology chapter quoting the Quran). Every other lesson
-- keeps the voice it has. The client's call, 15 Sep 2026.
--
-- A lesson is generated the first time a student plays it, streamed to them
-- part by part as it is made, and kept: from the second listener on it is an
-- ordinary audio file again. Nothing here is readable by students; the
-- website's server does all of it with the service role.

-- ─────────────────────────────────────────────── 1. which lessons, and their text

-- The narration each in-scope lesson is read from, as the current recordings
-- were. A row here is what puts a lesson in scope.
create table if not exists public.voice_scripts (
  chapter_id text not null references public.chapters (id) on delete cascade,
  medium public.content_medium not null,
  body text not null check (char_length(body) between 50 and 60000),
  created_at timestamptz not null default now(),
  primary key (chapter_id, medium)
);

alter table public.voice_scripts enable row level security;

comment on table public.voice_scripts is
  'Lesson narration for the premium voice. A row puts a lesson in scope. Server only.';

-- The track row says when its premium voice is still to come, so both apps
-- know to ask for the stream instead of the file, and which voice the file
-- in storage_path is.
alter table public.audio_tracks
  add column if not exists voice_pending boolean not null default false,
  add column if not exists voice text;

comment on column public.audio_tracks.voice_pending is
  'The premium voice for this lesson is not generated yet: the apps stream it from /api/audio/voice.';
comment on column public.audio_tracks.voice is
  'Which voice made the file at storage_path (null: the original recording).';

-- ─────────────────────────────────────────────── 2. the parts, as they are made

create table if not exists public.voice_parts (
  chapter_id text not null references public.chapters (id) on delete cascade,
  medium public.content_medium not null,
  voice text not null,
  part integer not null check (part >= 0),
  text_hash text not null,
  status text not null default 'generating' check (status in ('generating', 'ready', 'failed')),
  storage_path text,
  bytes integer,
  claimed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (chapter_id, medium, voice, part)
);

alter table public.voice_parts enable row level security;

comment on table public.voice_parts is
  'One generated stretch of a premium-voice lesson. Joined into the final file once every part is ready. Server only.';

-- Taking a part to generate. True when this caller has it: no row yet, a row
-- for different text, or a claim that went quiet (a request that died). False
-- when it is ready or somebody else is on it, so two students starting the
-- same lesson at once do not pay for it twice.
create or replace function public.claim_voice_part(p_chapter text, p_medium public.content_medium, p_voice text, p_part integer, p_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  got boolean;
begin
  insert into public.voice_parts as v (chapter_id, medium, voice, part, text_hash, status, claimed_at, updated_at)
  values (p_chapter, p_medium, p_voice, p_part, p_hash, 'generating', now(), now())
  on conflict (chapter_id, medium, voice, part) do update
    set text_hash = excluded.text_hash, status = 'generating', claimed_at = now(), updated_at = now(),
        storage_path = null, bytes = null
    where v.text_hash <> excluded.text_hash
       or v.status = 'failed'
       or (v.status = 'generating' and v.claimed_at < now() - interval '2 minutes')
  returning true into got;
  return coalesce(got, false);
end;
$$;

revoke all on function public.claim_voice_part(text, public.content_medium, text, integer, text) from public, anon, authenticated;
grant execute on function public.claim_voice_part(text, public.content_medium, text, integer, text) to service_role;

-- ─────────────────────────────────────────────── 3. what it costs this month

-- Characters sent to the voice service per Karachi month, against the
-- plan's allowance (voice_settings.monthly_chars). Past it, lessons not yet
-- generated keep the original voice until the month turns.
create table if not exists public.voice_usage (
  month text primary key,
  chars integer not null default 0
);

alter table public.voice_usage enable row level security;

create or replace function public.add_voice_usage(p_chars integer)
returns integer
language sql
security definer
set search_path = ''
as $$
  insert into public.voice_usage as u (month, chars)
  values (to_char(now() at time zone 'Asia/Karachi', 'YYYY-MM'), greatest(p_chars, 0))
  on conflict (month) do update set chars = u.chars + greatest(p_chars, 0)
  returning chars;
$$;

revoke all on function public.add_voice_usage(integer) from public, anon, authenticated;
grant execute on function public.add_voice_usage(integer) to service_role;

-- ─────────────────────────────────────────────── 4. the voice itself

-- One row: which voices, which model, the monthly allowance, and a switch.
-- Kept here rather than in the deployment's environment so a voice can be
-- changed, or the whole thing paused, without a redeploy. The key stays in
-- the environment (ELEVENLABS_API_KEY).
create table if not exists public.voice_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  voice_ur text,
  voice_en text,
  model text not null default 'eleven_v3',
  monthly_chars integer not null default 220000 check (monthly_chars >= 0),
  updated_at timestamptz not null default now()
);

alter table public.voice_settings enable row level security;

insert into public.voice_settings (id) values (true) on conflict (id) do nothing;

comment on table public.voice_settings is
  'The premium voice: on or off, the ElevenLabs voice ids for Urdu and English, the model and the monthly character allowance.';
