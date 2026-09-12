'use client';

/**
 * Real playback through a plain <audio> element, the browser handles buffering,
 * background playback and the OS media keys for free. The Android app needs
 * expo-audio for the same job; the transport and copy are deliberately identical.
 */
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import type { Chapter, PlayableTrack } from '@matricmate/core';
import { chapterName, isOneLanguageSubject, pickAudioTrack, subjectMedium } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Bar, Card, Icon, ScriptText } from '@/components/ui/primitives';
import { useApp, useT } from '@/lib/store';

const SPEEDS = [1, 1.25, 1.5] as const;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function AudioLesson({
  chapter,
  tracks,
}: {
  chapter: Chapter;
  /** Published recordings for this chapter, straight from Supabase Storage. */
  tracks: PlayableTrack[];
}) {
  const { state, actions } = useApp();
  const t = useT();
  const audio = useRef<HTMLAudioElement>(null);

  const id = chapter.id;
  /* The language this subject is taught in, for this student. The same as
     their medium except for Urdu and English (and Punjab's Islamiyat), which
     are recorded once, in their own language. */
  const medium = subjectMedium(id, chapter.board, state.settings.contentMedium);
  const oneLanguage = isOneLanguageSubject(id, chapter.board);
  // Was a bundled file path built from a hardcoded id, so only the one demo
  // chapter ever played. The URL now comes from the row that publishing wrote.
  const track = pickAudioTrack(tracks, medium);
  const src = track?.url ?? null;
  /* A file that will not load. The player used to sit at 0:00 with a play
     button that did nothing, and the string for saying so went unused. */
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = !!src && failedSrc === src;

  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(track?.durationSecs ?? 0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [loadedSrc, setLoadedSrc] = useState(src);

  // Switching study medium loads a different recording, start it from the top
  // rather than mid-sentence. Adjusted during render, not in an effect, so the
  // transport never paints the old position against the new file.
  if (src !== loadedSrc) {
    setLoadedSrc(src);
    setPosition(0);
    setPlaying(false);
  }

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = SPEEDS[speed];
  }, [speed]);

  const counted = useRef(false);

  useEffect(() => {

    counted.current = false;

  }, [id, medium]);


  function toggle() {
    const el = audio.current;
    if (!el || !src || failed) return;
    // play() rejects when the browser refuses (autoplay rules, a pause that
    // lands first) or the file cannot play. The element's own error event
    // reports a broken file; a refusal needs nothing more than staying paused.
    if (el.paused) el.play().catch(() => setPlaying(false));
    else el.pause();
  }

  function seek(delta: number) {
    const el = audio.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(duration, el.currentTime + delta));
  }

  return (
    <Page width="focus">
      <PageHead
        back={`/learn/chapter/${id}`}
        backLabel={chapterName(chapter, state.settings.language)}
        title={t('audio.title')}
      />

      {src ? (
        <audio
          ref={audio}
          src={src}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => {
            const at = e.currentTarget.currentTime;
            setPosition(at);
            /*
             * Listening counts as studying. It used to count as nothing: the
             * player recorded no attempt, no section and no active day, so an
             * hour of audio left the streak untouched. A minute in is past
             * skimming and well short of demanding the whole lesson.
             */
            if (at >= 60 && !counted.current) {
              counted.current = true;
              actions.markStudied();
            }
          }}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || (track?.durationSecs ?? 0))}
          onEnded={() => setPlaying(false)}
          onError={() => {
            setPlaying(false);
            setFailedSrc(src);
          }}
        />
      ) : null}

      <div className="flex flex-col items-center">
        <div className="flex h-[210px] w-[210px] items-center justify-center rounded-[24px] bg-teal">
          <Image src="/brand/monogram.png" alt="" width={130} height={90} loading="eager" className="h-auto w-[130px] object-contain" />
        </div>
        {/* The chapter's own name. This was content.audioTitle, which the live
            query fills from the bundled catalogue: three chapters have one and
            the other 154 are an empty string, so the player had no title at
            all. audio_tracks.title is a machine slug, not student copy. */}
        <h2 className="mt-4 w-full">
          <ScriptText
            text={chapterName(chapter, state.settings.language)}
            className="text-center font-display text-[22px] leading-[1.3] text-ink"
            urduClassName="text-center text-[21px] text-ink"
          />
        </h2>
        {/* What the recording is actually in. This described the student's
            medium, so an English-medium student played the Urdu lesson under
            "English narration". */}
        {track ? (
          <p className="text-center text-[13px] text-ink2">
            {track.medium === 'ur' ? t('audio.narrationUr') : t('audio.narrationEn')}
          </p>
        ) : null}
      </div>

      <div className="mt-6">
        <Bar pct={duration ? (position / duration) * 100 : 0} tone="teal" />
        <div className="mt-1.5 flex justify-between text-[13px] font-extrabold text-ink2 tabular">
          <span>{fmt(position)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => seek(-15)}
          disabled={!src || failed}
          aria-label={t('audio.back15')}
          className="flex h-[54px] w-[54px] items-center justify-center rounded-full border border-line bg-card text-[13px] font-extrabold text-ink tabular transition-colors duration-200 hover:bg-paper disabled:cursor-not-allowed disabled:opacity-40"
        >
          −15
        </button>
        <button
          type="button"
          onClick={toggle}
          disabled={!src || failed}
          aria-label={playing ? t('audio.pause') : t('audio.play')}
          className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-teal text-onbrand transition-[background-color,transform] duration-200 ease-out active:scale-[0.97] hover:bg-tealdark disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Icon name={playing ? 'pause' : 'play'} size={30} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={() => seek(15)}
          disabled={!src || failed}
          aria-label={t('audio.forward15')}
          className="flex h-[54px] w-[54px] items-center justify-center rounded-full border border-line bg-card text-[13px] font-extrabold text-ink tabular transition-colors duration-200 hover:bg-paper disabled:cursor-not-allowed disabled:opacity-40"
        >
          +15
        </button>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setSpeed((s) => (s + 1) % SPEEDS.length)}
          disabled={!src || failed}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-grey px-3.5 text-[12.5px] font-extrabold text-ink2 transition-[filter] duration-200 hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {t('audio.speed', { n: SPEEDS[speed] })}
        </button>

      </div>

      <Card
        flat
        tint={failed ? 'bg-redtint' : src ? 'bg-tealtint' : 'bg-orangetint'}
        border={failed ? 'border-red' : src ? 'border-tealtint2' : 'border-orangetint'}
        className="mt-6"
      >
        <p role={failed ? 'alert' : undefined} className="text-[13px] leading-[1.6] text-ink2 rtl:leading-[1.9]">
          {failed
            ? t('audio.loadFailed')
            : !src
              ? t('audio.noTrackNote')
              : oneLanguage
                ? t(medium === 'ur' ? 'audio.oneLanguageUr' : 'audio.oneLanguageEn')
                : t('audio.sampleNote')}
        </p>
      </Card>
    </Page>
  );
}
