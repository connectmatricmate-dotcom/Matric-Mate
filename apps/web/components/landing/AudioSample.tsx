'use client';

/**
 * A real recording from the app, playable on the page. Claiming "audio lessons"
 * is cheap; letting someone hear one costs nothing and settles it.
 */
import { useEffect, useRef, useState } from 'react';
import { Icon, Pill } from '@/components/ui';

const TRACKS = {
  en: { src: '/audio/dynamics-en.mp3', label: 'English narration' },
  ur: { src: '/audio/dynamics-ur.mp3', label: 'Urdu narration' },
};

export function AudioSample() {
  const [lang, setLang] = useState<'en' | 'ur'>('en');
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.load();
    setPlaying(false);
    setProgress(0);
  }, [lang]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div className="rounded-[16px] border border-line bg-card p-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={playing ? 'Pause sample' : 'Play sample'}
          onClick={() => {
            const a = audioRef.current;
            if (!a) return;
            if (playing) a.pause();
            else void a.play();
          }}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-teal text-white transition-transform hover:scale-105"
        >
          <Icon name={playing ? 'pause' : 'play'} size={24} strokeWidth={2.2} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-extrabold text-ink">Chapter 3 — Dynamics</p>
          <p className="text-[12.5px] text-ink2">{TRACKS[lang].label} · full chapter</p>
          <div className="mt-2 h-[6px] overflow-hidden rounded-full bg-[#EAF0EC]">
            <div className="h-full rounded-full bg-orange" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[11px] font-extrabold text-ink3">
            <span>{fmt((progress / 100) * duration)}</span>
            <span>{duration ? fmt(duration) : '—'}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Pill tone={lang === 'en' ? 'teal' : 'grey'} onClick={() => setLang('en')}>
          English
        </Pill>
        <Pill tone={lang === 'ur' ? 'teal' : 'grey'} onClick={() => setLang('ur')}>
          <span className="font-urdu leading-[2]">اردو</span>
        </Pill>
        <span className="ml-auto text-[11.5px] text-ink3">Sample lesson</span>
      </div>

      <audio
        ref={audioRef}
        src={TRACKS[lang].src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setProgress((e.currentTarget.currentTime / (e.currentTarget.duration || 1)) * 100)}
      />
    </div>
  );
}
