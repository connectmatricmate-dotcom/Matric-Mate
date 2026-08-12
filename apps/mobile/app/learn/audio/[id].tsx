import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { ErrorBoundary } from '../../../src/components/ErrorBoundary';
import { Icon } from '../../../src/components/Icon';
import { Bar, Card, H2, Header, IconButton, Pill, Row, Screen, Small, Spacer, Tap, useToast } from '../../../src/components/ui';
import { api, pickAudioTrack } from '@matricmate/core';
import { audioSource } from '../../../src/core/audio';
import { useAsync } from '../../../src/core/useAsync';
import { useT } from '../../../src/i18n';
import { useApp } from '../../../src/store/app';
import { C, F, S } from '../../../src/theme';

const SPEEDS = [1, 1.25, 1.5] as const;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Everything visual. Both the real player and the fallback render through this. */
function PlayerChrome({
  title,
  subtitle,
  position,
  duration,
  playing,
  speed,
  onPlay,
  onSeek,
  onSpeed,
  disabled,
  note,
  downloaded,
  busy,
  onToggleDownload,
}: {
  title: string;
  subtitle: string;
  position: number;
  duration: number;
  playing: boolean;
  speed: number;
  onPlay: () => void;
  onSeek: (delta: number) => void;
  onSpeed: () => void;
  disabled?: boolean;
  note: string;
  downloaded: boolean;
  busy?: boolean;
  onToggleDownload: () => void;
}) {
  const t = useT();
  return (
    <Screen>
      <Header
        title={t('audio.title')}
        back
        right={
          busy ? (
            <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="small" color={C.teal} />
            </View>
          ) : (
            <IconButton
              icon={downloaded ? 'check' : 'download'}
              tone={downloaded ? 'active' : 'card'}
              onPress={onToggleDownload}
            />
          )
        }
      />

      <View style={{ alignItems: 'center', marginTop: S.md }}>
        <View style={{ width: 210, height: 210, borderRadius: 24, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' }}>
          <Image source={require('../../../assets/monogram.png')} style={{ width: 130, height: 100 }} resizeMode="contain" />
        </View>
        <H2 style={{ marginTop: S.md, textAlign: 'center' }}>{title}</H2>
        <Small style={{ textAlign: 'center' }}>{subtitle}</Small>
      </View>

      <Spacer h={S.lg} />
      <Bar pct={duration ? (position / duration) * 100 : 0} tone="teal" />
      <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
        <Small style={{ fontFamily: F.bodyBold }}>{fmt(position)}</Small>
        <Small style={{ fontFamily: F.bodyBold }}>{fmt(duration)}</Small>
      </Row>

      <Row style={{ justifyContent: 'center', marginTop: S.lg }} gap={S.xl}>
        <Tap onPress={() => onSeek(-15)} disabled={disabled}>
          <View style={[ctl, disabled && { opacity: 0.4 }]}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: C.ink }}>−15</Text>
          </View>
        </Tap>
        <Tap onPress={onPlay} disabled={disabled}>
          <View
            testID="audio-play"
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Pause' : 'Play'}
            style={{
              width: 76,
              height: 76,
              borderRadius: 99,
              backgroundColor: disabled ? C.ink3 : C.teal,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={playing ? 'pause' : 'play'} size={30} color="#fff" strokeWidth={2.2} />
          </View>
        </Tap>
        <Tap onPress={() => onSeek(15)} disabled={disabled}>
          <View style={[ctl, disabled && { opacity: 0.4 }]}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: C.ink }}>+15</Text>
          </View>
        </Tap>
      </Row>

      <Row style={{ justifyContent: 'center', marginTop: S.md }} gap={S.sm}>
        <Pill tone="grey" onPress={disabled ? undefined : onSpeed}>
          {t('audio.speed', { n: SPEEDS[speed] })}
        </Pill>
        <Pill tone={downloaded ? 'green' : 'grey'} icon={downloaded ? 'check' : 'download'}>
          {downloaded ? t('audio.offline') : t('audio.stream')}
        </Pill>
      </Row>

      <Card flat tint={disabled ? C.orangeTint : C.tealTint} style={{ marginTop: S.lg }}>
        <Small>{note}</Small>
      </Card>
    </Screen>
  );
}

/** Real playback. Throws on a build that predates expo-audio, see the boundary below. */
function RealPlayer({ id }: { id: string }) {
  const { state, actions } = useApp();
  const t = useT();
  const toast = useToast();
  const { data: chapter } = useAsync(() => api.getChapter(id), [id]);
  const { data: content } = useAsync(() => api.getChapterContent(id), [id]);

  const medium = state.settings.contentMedium;
  const { data: tracks } = useAsync(() => api.getAudioTracks(id), [id]);
  const track = audioSource(pickAudioTrack(tracks ?? [], medium));
  const player = useAudioPlayer(track);
  const status = useAudioPlayerStatus(player);
  const [speed, setSpeed] = useState(0);
  const [busy, setBusy] = useState(false);
  const downloaded = state.downloads.includes(id);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true }).catch(() => {});
  }, []);

  useEffect(() => {
    if (track) player.replace(track);
  }, [track]); // eslint-disable-line react-hooks/exhaustive-deps

  const duration = status.duration || (chapter?.audioMinutes ?? 14) * 60;
  const position = status.currentTime || 0;

  return (
    <PlayerChrome
      title={content?.audioTitle ?? ''}
      subtitle={medium === 'ur' ? t('audio.narrationUr') : t('audio.narrationEn')}
      position={position}
      duration={duration}
      playing={status.playing}
      speed={speed}
      disabled={!track}
      onPlay={() => {
        if (!track) return;
        if (status.playing) player.pause();
        else {
          if (status.didJustFinish) player.seekTo(0);
          player.play();
        }
      }}
      onSeek={(d) => player.seekTo(Math.max(0, Math.min(duration, position + d)))}
      onSpeed={() => {
        const next = (speed + 1) % SPEEDS.length;
        setSpeed(next);
        player.setPlaybackRate(SPEEDS[next]);
      }}
      note={track ? t('audio.sampleNote') : t('audio.noTrackNote')}
      downloaded={downloaded}
      busy={busy}
      onToggleDownload={async () => {
        setBusy(true);
        const result = await actions.toggleDownload(id);
        setBusy(false);
        if (result === 'downloaded') toast(t('study.saveOffline'));
        else if (result === 'removed') toast(t('study.removedOffline'));
        else toast(t('downloads.saveFailed'));
      }}
    />
  );
}

/**
 * Shown when the installed binary has no audio support yet. The screen still
 * works, the transport just runs on a timer, so a dev build from before the
 * module was added keeps every other screen usable.
 */
function PreviewPlayer({ id }: { id: string }) {
  const { state, actions } = useApp();
  const t = useT();
  const toast = useToast();
  const { data: chapter } = useAsync(() => api.getChapter(id), [id]);
  const { data: content } = useAsync(() => api.getChapterContent(id), [id]);

  const duration = (chapter?.audioMinutes ?? 14) * 60;
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [busy, setBusy] = useState(false);
  const downloaded = state.downloads.includes(id);

  useEffect(() => {
    if (playing) timer.current = setInterval(() => setPosition((p) => Math.min(duration, p + SPEEDS[speed])), 1000);
    else if (timer.current) clearInterval(timer.current);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, speed, duration]);

  return (
    <PlayerChrome
      title={content?.audioTitle ?? ''}
      subtitle={state.settings.contentMedium === 'ur' ? t('audio.narrationUr') : t('audio.narrationEn')}
      position={position}
      duration={duration}
      playing={playing}
      speed={speed}
      onPlay={() => setPlaying((p) => !p)}
      onSeek={(d) => setPosition((p) => Math.max(0, Math.min(duration, p + d)))}
      onSpeed={() => setSpeed((s) => (s + 1) % SPEEDS.length)}
      note={t('audio.needsNewBuild')}
      downloaded={downloaded}
      busy={busy}
      onToggleDownload={async () => {
        setBusy(true);
        const result = await actions.toggleDownload(id);
        setBusy(false);
        if (result === 'downloaded') toast(t('study.saveOffline'));
        else if (result === 'removed') toast(t('study.removedOffline'));
        else toast(t('downloads.saveFailed'));
      }}
    />
  );
}

export default function AudioLesson() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ErrorBoundary fallback={<PreviewPlayer id={id} />}>
      <RealPlayer id={id} />
    </ErrorBoundary>
  );
}

const ctl = {
  width: 54,
  height: 54,
  borderRadius: 99,
  borderWidth: 1,
  borderColor: C.line,
  backgroundColor: C.card,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};
