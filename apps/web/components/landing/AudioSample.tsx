'use client';

/**
 * A real recording from the app, playable on the page. Claiming "audio lessons"
 * is cheap; letting someone hear one costs nothing and settles it.
 */
import { useEffect, useRef, useState } from 'react';
import { Bar, Card, Icon, pillClasses } from '@/components/ui';

const TRACKS = {
  en: { src: '/audio/dynamics-en.mp3', label: 'English narration', name: 'English' },
  ur: { src: '/audio/dynamics-ur.mp3', label: 'Urdu narration', name: 'Urdu' },
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
    <Card>
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
          className="flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full bg-teal text-white transition-colors duration-200 hover:bg-tealdark"
        >
          <Icon name={playing ? 'pause' : 'play'} size={24} strokeWidth={2.2} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[15.5px] font-extrabold text-ink">Chapter 3 · Dynamics</p>
          <p className="text-[13.5px] text-ink2">{TRACKS[lang].label} · full chapter</p>
          <div className="mt-2">
            <Bar pct={progress} tone="orange" h={6} />
          </div>
          <div className="mt-1 flex justify-between text-[11.5px] font-extrabold text-ink3">
            <span>{fmt((progress / 100) * duration)}</span>
            <span>{duration ? fmt(duration) : '0:00'}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {(['en', 'ur'] as const).map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={lang === l}
            onClick={() => setLang(l)}
            className={pillClasses(lang === l ? 'teal' : 'grey', true, 'min-h-10')}
          >
            {/* The check is the non-colour cue for which narration is selected. */}
            {lang === l ? <Icon name="check" size={12} strokeWidth={2.8} /> : null}
            {TRACKS[l].name}
          </button>
        ))}
        <span className="ml-auto text-[12.5px] text-ink3">Sample lesson</span>
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
    </Card>
  );
}
