'use client';

/**
 * Real playback through a plain <audio> element, the browser handles buffering,
 * background playback and the OS media keys for free. The Android app needs
 * expo-audio for the same job; the transport and copy are deliberately identical.
 */
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import type { Chapter, PlayableTrack, VoiceStream } from '@matricmate/core';
import { chapterName, fetchVoiceStream, isOneLanguageSubject, pickAudioTrack, subjectMedium } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Bar, Card, Icon, ScriptText } from '@/components/ui/primitives';
import { useApp, useT } from '@/lib/store';

const SPEEDS = [1, 1.25, 1.5] as const;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * What is playing instead of the track's own file, for a lesson whose premium
 * voice is still being made (Islamiyat, Urdu, other Islamic content).
 *
 * A stream is the lesson made as it plays: it cannot be skipped through, and
 * its clock starts at `offset`, where it was asked to start. A file is the
 * finished lesson, swapped in the moment it exists so skipping works again.
 */
type Voice = { src: string; stream: boolean; offset: number; estSecs: number; fileSecs?: number };

/** How long a play press waits for the stream before playing the file it has. */
const ASK_MS = 8000;
/** While streaming, how often to look for the finished file. */
const POLL_MS = 20_000;

const askVoice = (chapterId: string, medium: 'en' | 'ur', at: number): Promise<VoiceStream | null> =>
  Promise.race([fetchVoiceStream(chapterId, medium, at), new Promise<null>((r) => setTimeout(() => r(null), ASK_MS))]);

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
  const fileUrl = track?.url ?? null;
  const [voice, setVoice] = useState<Voice | null>(null);
  const [asking, setAsking] = useState(false);
  const src = voice?.src ?? fileUrl;
  const streaming = !!voice?.stream;
  /* A file that will not load. The player used to sit at 0:00 with a play
     button that did nothing, and the string for saying so went unused. */
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = !!src && failedSrc === src;

  const [position, setPosition] = useState(0);
  const [fileDuration, setFileDuration] = useState(track?.durationSecs ?? 0);
  // A stream has no length until it is over: the lesson's estimated one meanwhile.
  const duration = streaming ? (voice?.estSecs ?? 0) : fileDuration;
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [loadedTrack, setLoadedTrack] = useState(track?.id ?? null);

  /** Where to put the playhead, and whether to play, once the next source loads. */
  const resume = useRef<{ at: number; play: boolean } | null>(null);
  /** The stream is asked for once per visit; after that the answer stands. */
  const asked = useRef(false);
  /** The last point a stream was asked again from, and how often: the same point twice means it is not moving. */
  const retry = useRef({ at: -1, count: 0 });

  // Switching study medium loads a different recording, start it from the top
  // rather than mid-sentence. Adjusted during render, not in an effect, so the
  // transport never paints the old position against the new file.
  if ((track?.id ?? null) !== loadedTrack) {
    setLoadedTrack(track?.id ?? null);
    setVoice(null);
    setPosition(0);
    setPlaying(false);
    setFileDuration(track?.durationSecs ?? 0);
  }
  useEffect(() => {
    asked.current = false;
    resume.current = null;
    retry.current = { at: -1, count: 0 };
  }, [track?.id]);

  // Loading a new source resets the rate, so it is set again on every swap.
  // A lesson being made as it plays is heard at 1x only: faster than that
  // could overtake the voice making it.
  useEffect(() => {
    if (!audio.current) return;
    const rate = streaming ? 1 : SPEEDS[speed];
    audio.current.defaultPlaybackRate = rate;
    audio.current.playbackRate = rate;
  }, [speed, src, streaming]);

  // A new source (the stream, or the finished file swapped in) plays straight
  // away when the press or the swap asked for it. The seek waits for metadata.
  useEffect(() => {
    const el = audio.current;
    if (!el || !resume.current?.play) return;
    el.play().catch(() => setPlaying(false));
  }, [src]);

  /**
   * The lesson from `at` seconds in, after a stream stopped: the finished
   * file when it exists (at the same point, since the stream is made of the
   * very same parts), more of the stream when it is still being made, and
   * the old recording at about the same point when neither can be had, so a
   * student is never left with silence mid-lesson.
   */
  async function carryOn(at: number, play: boolean) {
    if (!track || !voice) return;
    if (Math.abs(retry.current.at - at) < 2) retry.current.count += 1;
    else retry.current = { at, count: 1 };
    const r = retry.current.count > 2 ? null : await askVoice(track.chapterId, track.medium, at);
    if (r?.url) {
      const end = !!r.durationSecs && at >= r.durationSecs - 3;
      resume.current = end ? null : { at, play };
      setVoice({ src: r.url, stream: false, offset: 0, estSecs: 0, fileSecs: r.durationSecs });
      if (r.durationSecs) setFileDuration(r.durationSecs);
    } else if (r?.stream) {
      resume.current = { at: 0, play };
      setVoice({ src: r.stream, stream: true, offset: at, estSecs: r.estSecs || voice.estSecs });
    } else if (r?.reason === 'end') {
      // It was the end of the lesson. The next press asks afresh, and by then it is a file.
      asked.current = false;
      resume.current = null;
      setVoice(null);
    } else {
      const ratio = voice.estSecs ? Math.min(1, at / voice.estSecs) : 0;
      resume.current = { at: Math.max(0, ratio * (track.durationSecs || 0) - 3), play };
      setVoice({ src: fileUrl ?? '', stream: false, offset: 0, estSecs: 0 });
    }
  }

  // While the lesson streams, look now and then for the finished file, and
  // move to it at the same point: from then on the seek buttons work.
  useEffect(() => {
    if (!streaming || !playing || !track) return;
    const timer = setInterval(async () => {
      const el = audio.current;
      if (!el || !voice) return;
      const r = await fetchVoiceStream(track.chapterId, track.medium);
      if (!r?.url || !audio.current || audio.current.src !== voice.src) return;
      resume.current = { at: voice.offset + audio.current.currentTime, play: !audio.current.paused };
      setVoice({ src: r.url, stream: false, offset: 0, estSecs: 0, fileSecs: r.durationSecs });
      if (r.durationSecs) setFileDuration(r.durationSecs);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [streaming, playing, track, voice]);

  const counted = useRef(false);

  useEffect(() => {

    counted.current = false;

  }, [id, medium]);


  async function toggle() {
    const el = audio.current;
    if (!el || !src || failed || asking) return;
    if (!el.paused) {
      el.pause();
      return;
    }
    // The first press on a lesson whose new voice is still being made asks
    // for it. Asked here and not on opening, because asking starts it being
    // made, and a student who opens the page and leaves should cost nothing.
    if (track?.voicePending && !voice && !asked.current) {
      asked.current = true;
      setAsking(true);
      const r = await askVoice(track.chapterId, track.medium, 0);
      setAsking(false);
      if (r?.stream) {
        resume.current = { at: 0, play: true };
        setSpeed(0);
        setVoice({ src: r.stream, stream: true, offset: 0, estSecs: r.estSecs || track.durationSecs });
        return;
      }
      if (r?.url) {
        resume.current = { at: 0, play: true };
        setVoice({ src: r.url, stream: false, offset: 0, estSecs: 0, fileSecs: r.durationSecs });
        if (r.durationSecs) setFileDuration(r.durationSecs);
        return;
      }
    }
    // play() rejects when the browser refuses (autoplay rules, a pause that
    // lands first) or the file cannot play. The element's own error event
    // reports a broken file; a refusal needs nothing more than staying paused.
    el.play().catch(() => setPlaying(false));
  }

  function seek(delta: number) {
    const el = audio.current;
    if (!el || streaming) return;
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
          // A stream is only ever loaded by a press: loading it is what makes it.
          preload={streaming ? 'none' : 'metadata'}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => {
            const at = (voice?.stream ? voice.offset : 0) + e.currentTarget.currentTime;
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
          onLoadedMetadata={(e) => {
            const el = e.currentTarget;
            if (!streaming) {
              setFileDuration(Number.isFinite(el.duration) && el.duration > 0 ? el.duration : (voice?.fileSecs ?? track?.durationSecs ?? 0));
              if (resume.current?.at) el.currentTime = resume.current.at;
            }
            resume.current = null;
          }}
          onEnded={(e) => {
            setPlaying(false);
            // A stream ends at the end of the lesson, or early (its time ran
            // out, the connection dropped): ask again from here to find out.
            if (streaming && voice) void carryOn(voice.offset + e.currentTarget.currentTime, true);
          }}
          onError={(e) => {
            setPlaying(false);
            if (streaming && voice) void carryOn(voice.offset + e.currentTarget.currentTime, true);
            else setFailedSrc(src);
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
          disabled={!src || failed || streaming}
          aria-label={t('audio.back15')}
          className="flex h-[54px] w-[54px] items-center justify-center rounded-full border border-line bg-card text-[13px] font-extrabold text-ink tabular transition-colors duration-200 hover:bg-paper disabled:cursor-not-allowed disabled:opacity-40"
        >
          −15
        </button>
        <button
          type="button"
          onClick={toggle}
          disabled={!src || failed}
          aria-busy={asking || undefined}
          aria-label={playing ? t('audio.pause') : t('audio.play')}
          className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-teal text-onbrand transition-[background-color,transform] duration-200 ease-out active:scale-[0.97] hover:bg-tealdark disabled:cursor-not-allowed disabled:opacity-45 aria-busy:cursor-wait"
        >
          {asking ? (
            <Icon name="refresh" size={28} strokeWidth={2.2} className="animate-spin" />
          ) : (
            <Icon name={playing ? 'pause' : 'play'} size={30} strokeWidth={2.2} />
          )}
        </button>
        <button
          type="button"
          onClick={() => seek(15)}
          disabled={!src || failed || streaming}
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
          disabled={!src || failed || streaming}
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
              : streaming
                ? t('audio.voiceMaking')
                : oneLanguage
                ? t(medium === 'ur' ? 'audio.oneLanguageUr' : 'audio.oneLanguageEn')
                : t('audio.sampleNote')}
        </p>
      </Card>
    </Page>
  );
}
