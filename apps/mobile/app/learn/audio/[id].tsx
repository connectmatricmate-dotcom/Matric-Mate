import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { ErrorBoundary } from '../../../src/components/ErrorBoundary';
import { Icon } from '../../../src/components/Icon';
import { Bar, Card, H2, Header, IconButton, Pill, Row, Screen, Small, Spacer, Tap, useToast } from '../../../src/components/ui';
import { api, pickAudioTrack } from '@matricmate/core';
import { Equalizer } from '../../../src/components/celebration';
import { audioSource } from '../../../src/core/audio';
import { localAudioTrack, localAudioUri } from '../../../src/core/downloads';
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
  offlineAudio,
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
  /**
   * Whether the lesson file is really on disk, which is not the same thing as
   * the chapter being downloaded. The pill used to read `downloaded`, so it
   * claimed "Offline" for a chapter whose text was saved and whose audio was
   * still streaming.
   */
  offlineAudio: boolean;
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
        <Row gap={8} style={{ marginTop: S.md, alignItems: 'center' }}>
          <Equalizer playing={playing} color={C.teal} />
          <H2 style={{ textAlign: 'center' }}>{title}</H2>
          <Equalizer playing={playing} color={C.teal} />
        </Row>
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
          <View style={[ctl(), disabled && { opacity: 0.4 }]}>
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
            <Icon name={playing ? 'pause' : 'play'} size={30} color={C.onBrand} strokeWidth={2.2} />
          </View>
        </Tap>
        <Tap onPress={() => onSeek(15)} disabled={disabled}>
          <View style={[ctl(), disabled && { opacity: 0.4 }]}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: C.ink }}>+15</Text>
          </View>
        </Tap>
      </Row>

      <Row style={{ justifyContent: 'center', marginTop: S.md }} gap={S.sm}>
        <Pill tone="grey" onPress={disabled ? undefined : onSpeed}>
          {t('audio.speed', { n: SPEEDS[speed] })}
        </Pill>
        <Pill tone={offlineAudio ? 'green' : 'grey'} icon={offlineAudio ? 'check' : 'download'}>
          {offlineAudio ? t('audio.offline') : t('audio.stream')}
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
  const { data: content } = useAsync(() => api.getChapterContent(id), [id]);

  const medium = state.settings.contentMedium;
  const { data: tracks, loading: tracksLoading, error: tracksError } = useAsync(() => api.getAudioTracks(id), [id]);
  // Membership, not the array: this is what actually decides whether files
  // exist on disk, and it changes exactly when a download lands or is removed.
  const isDownloaded = state.downloads.includes(id);
  // Disk is only touched when the inputs change, not on every render: the
  // status hook re-renders this component twice a second during playback, and
  // each of these used to stat and parse files on the JS thread every time.
  const localTrack = useMemo(() => (isDownloaded ? localAudioTrack(id, medium) : null), [id, medium, isDownloaded]);
  const picked = pickAudioTrack(tracks ?? [], medium) ?? localTrack;
  // The downloaded copy wins over the stream, so a saved chapter plays with no
  // signal and a replay costs the student no data.
  const offlineUri = useMemo(
    () => (picked && isDownloaded ? localAudioUri(id, picked.medium) : null),
    [id, picked, isDownloaded],
  );
  /**
   * The hook owns source changes, nothing here calls player.replace().
   *
   * useAudioPlayer keys the underlying player on the stringified source, so
   * when the URI changes it builds a new player already loaded with it and
   * releases the old one. The first version of this screen did not know that
   * and replaced the source from an effect keyed on a track object rebuilt
   * every render; the status hook re-renders twice a second, so the player
   * restarted its load twice a second and nothing ever played.
   */
  const remoteUri = audioSource(picked)?.uri ?? null;
  const uri = offlineUri ?? remoteUri;
  const track = useMemo(() => (uri ? { uri } : null), [uri]);
  const player = useAudioPlayer(track);

  const status = useAudioPlayerStatus(player);
  const [speed, setSpeed] = useState(0);
  const [busy, setBusy] = useState(false);
  const downloaded = state.downloads.includes(id);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true }).catch(() => {});
  }, []);

  // A new player starts at 1x, but the speed pill keeps its state across a
  // source switch. Re-applied whenever either changes, so they cannot drift.
  useEffect(() => {
    player.setPlaybackRate(SPEEDS[speed]);
  }, [player, speed]);

  // Until the file's own metadata arrives, the row's measured duration is the
  // truth. audioMinutes on the chapter row is a summary for the lists.
  const duration = status.duration || picked?.durationSecs || 0;
  const position = status.currentTime || 0;

  /**
   * Listening counts as studying.
   *
   * It used to count as nothing: the player recorded no attempt, no section
   * and no active day, so a student who worked through an hour of audio ended
   * the day with no streak and a chapter still at zero. A minute in is the
   * threshold, which is past skimming and well short of demanding the whole
   * lesson.
   */
  const counted = useRef(false);
  useEffect(() => {
    if (counted.current || position < 60) return;
    counted.current = true;
    actions.markStudied();
  }, [position, actions]);
  useEffect(() => {
    counted.current = false;
  }, [id, medium]);

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
      onSpeed={() => setSpeed((n) => (n + 1) % SPEEDS.length)}
      /**
       * Three different states, and they used to render as one.
       *
       * While the track list is still being fetched there is no URL yet, so the
       * screen showed "no recording for this chapter" over dead controls, for a
       * chapter that has one. A slow request looked exactly like a missing
       * lesson. A failed request looked like one too, silently.
       */
      note={
        track
          ? t('audio.sampleNote')
          : tracksLoading
            ? t('common.loading')
            : tracksError
              ? t('audio.loadFailed')
              : t('audio.noTrackNote')
      }
      downloaded={downloaded}
      offlineAudio={!!offlineUri}
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
  const { data: content } = useAsync(() => api.getChapterContent(id), [id]);

  // This boundary only exists for binaries that predate expo-audio, and it
  // cannot play anything. A made-up "14 minutes" was worse than saying so.
  const duration = 0;
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
      offlineAudio={!!localAudioUri(id, state.settings.contentMedium)}
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

/**
 * A function, not a constant, for the same reason as SessionHeader's segment
 * colours: read at module load it froze the seek buttons on the launch
 * palette, so a student in dark mode got two white discs with a pale border.
 */
const ctl = () => ({
  width: 54,
  height: 54,
  borderRadius: 99,
  borderWidth: 1,
  borderColor: C.line,
  backgroundColor: C.card,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
});
