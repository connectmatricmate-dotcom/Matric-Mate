'use client';

/**
 * Real playback through a plain <audio> element, the browser handles buffering,
 * background playback and the OS media keys for free. The Android app needs
 * expo-audio for the same job; the transport and copy are deliberately identical.
 */
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import type { Chapter } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { IconButton } from '@/components/ui/controls';
import { Bar, Card, Icon, Pill } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { useApp, useT } from '@/lib/store';

const SPEEDS = [1, 1.25, 1.5] as const;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function AudioLesson({
  chapter,
  audioTitle,
  tracks,
}: {
  chapter: Chapter;
  audioTitle: string;
  tracks: { en?: string; ur?: string } | null;
}) {
  const { state, actions } = useApp();
  const t = useT();
  const toast = useToast();
  const audio = useRef<HTMLAudioElement>(null);

  const id = chapter.id;
  const medium = state.settings.contentMedium;
  const trackId = tracks ? (tracks[medium] ?? tracks.en) : null;
  const src = trackId ? `/audio/${trackId}.mp3` : null;

  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(chapter.audioMinutes * 60);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [loadedSrc, setLoadedSrc] = useState(src);
  const downloaded = state.downloads.includes(id);

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

  function toggle() {
    const el = audio.current;
    if (!el || !src) return;
    if (el.paused) void el.play();
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
        backLabel={chapter.title}
        title={t('audio.title')}
        actions={
          <IconButton
            icon={downloaded ? 'check' : 'download'}
            tone={downloaded ? 'active' : 'card'}
            // The label names the ACTION a press performs; the toast reports
            // the RESULT. They used to be the same string in the wrong tense.
            label={downloaded ? t('study.removeOffline') : t('study.saveOffline')}
            onClick={() => {
              actions.toggleDownload(id);
              toast(downloaded ? t('study.removedOffline') : t('study.savedOffline'));
            }}
          />
        }
      />

      {src ? (
        <audio
          ref={audio}
          src={src}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || chapter.audioMinutes * 60)}
          onEnded={() => setPlaying(false)}
        />
      ) : null}

      <div className="flex flex-col items-center">
        <div className="flex h-[210px] w-[210px] items-center justify-center rounded-[24px] bg-teal">
          <Image src="/brand/monogram.png" alt="" width={130} height={100} className="h-auto w-[130px] object-contain" />
        </div>
        <h2 className="mt-4 text-center font-display text-[22px] text-ink">{audioTitle}</h2>
        <p className="text-center text-[13px] text-ink2">
          {medium === 'ur' ? t('audio.narrationUr') : t('audio.narrationEn')}
        </p>
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
          disabled={!src}
          aria-label={t('audio.back15')}
          className="flex h-[54px] w-[54px] items-center justify-center rounded-full border border-line bg-card text-[13px] font-extrabold text-ink transition-colors duration-200 hover:bg-paper disabled:opacity-40"
        >
          −15
        </button>
        <button
          type="button"
          onClick={toggle}
          disabled={!src}
          aria-label={playing ? t('audio.pause') : t('audio.play')}
          className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-teal text-white transition-[background-color,transform] duration-200 ease-out active:scale-[0.97] hover:bg-tealdark disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Icon name={playing ? 'pause' : 'play'} size={30} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={() => seek(15)}
          disabled={!src}
          aria-label={t('audio.forward15')}
          className="flex h-[54px] w-[54px] items-center justify-center rounded-full border border-line bg-card text-[13px] font-extrabold text-ink transition-colors duration-200 hover:bg-paper disabled:opacity-40"
        >
          +15
        </button>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setSpeed((s) => (s + 1) % SPEEDS.length)}
          disabled={!src}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-grey px-3.5 text-[12.5px] font-extrabold text-ink2 transition-colors duration-200 hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {t('audio.speed', { n: SPEEDS[speed] })}
        </button>
        <Pill tone={downloaded ? 'green' : 'grey'} icon={downloaded ? 'check' : 'download'}>
          {downloaded ? t('audio.offline') : t('audio.stream')}
        </Pill>
      </div>

      <Card
        flat
        tint={src ? 'bg-tealtint' : 'bg-orangetint'}
        border={src ? 'border-tealtint2' : 'border-orangetint'}
        className="mt-6"
      >
        <p className="text-[13px] leading-[1.6] text-ink2">{src ? t('audio.sampleNote') : t('audio.noTrackNote')}</p>
      </Card>
    </Page>
  );
}
