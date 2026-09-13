import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { ErrorBoundary } from '../../../src/components/ErrorBoundary';
import { Icon } from '../../../src/components/Icon';
import { Bar, Card, H2, Header, IconButton, Pill, Row, Screen, Small, Spacer, Tap, Text } from '../../../src/components/ui';
import { api, chapterById, chapterName, isOneLanguageSubject, pickAudioTrack, subjectMedium } from '@matricmate/core';
import type { Medium } from '@matricmate/core';
import { Equalizer } from '../../../src/components/celebration';
import { useChapterDownload } from '../../../src/components/ChapterDownload';
import { audioSource } from '../../../src/core/audio';
import { useOnline } from '../../../src/core/connectivity';
import { localAudioTrack, localAudioUri, localChapter } from '../../../src/core/downloads';
import { useAsync } from '../../../src/core/useAsync';
import { useT } from '../../../src/i18n';
import type { StringKey } from '../../../src/i18n';
import { useApp } from '../../../src/store/app';
import { C, F, S } from '../../../src/theme';

const SPEEDS = [1, 1.25, 1.5] as const;

/**
 * What the player is playing.
 *
 * This was `content.audioTitle`, which the live query fills from the bundled
 * catalogue: three chapters have one and the other 154 have an empty string.
 * So the player showed its artwork, two equalizers and nothing between them,
 * and a student could not tell which lesson was open. The chapter's own name
 * is the honest title, and `audio_tracks.title` is a machine slug
 * ("math-9 audio lesson") rather than anything to show a student.
 *
 * Synchronous: the hub is the only way in and has already primed the lookup,
 * and offline the row saved with the download answers.
 */
const lessonTitle = (chapterId: string, lang: string): string =>
  chapterName(chapterById(chapterId) ?? localChapter(chapterId) ?? undefined, lang);
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** "Urdu narration" or "English narration", for the recording actually playing. */
const narration = (medium: Medium): StringKey => (medium === 'ur' ? 'audio.narrationUr' : 'audio.narrationEn');

/**
 * The line under the player. A language subject is recorded once, in its own
 * language, so "if your medium has no recording, the English one plays" was
 * a promise about a track that is never coming for an Urdu lesson.
 */
const lessonNote = (chapterId: string, board: string | undefined): StringKey =>
  isOneLanguageSubject(chapterId, board === 'punjab' ? 'punjab' : 'fbise')
    ? subjectMedium(chapterId, board === 'punjab' ? 'punjab' : 'fbise', 'en') === 'ur'
      ? 'audio.oneLanguageUr'
      : 'audio.oneLanguageEn'
    : 'audio.sampleNote';

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
  confirm,
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
  /** The confirm sheet a removal asks through. */
  confirm?: ReactNode;
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
      {confirm}

      <View style={{ alignItems: 'center', marginTop: S.md }}>
        <View style={{ width: 210, height: 210, borderRadius: 24, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' }}>
          <Image source={require('../../../assets/monogram.png')} style={{ width: 130, height: 100 }} resizeMode="contain" />
        </View>
        <Row gap={8} style={{ marginTop: S.md, alignItems: 'center' }}>
          <Equalizer playing={playing} color={C.teal} />
          {/* Wraps between the two equalizers; a chapter name that could not
              shrink pushed the right one, and its own end, off the screen. */}
          <H2 style={{ textAlign: 'center', flexShrink: 1 }}>{title}</H2>
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
        <Tap onPress={() => onSeek(-15)} disabled={disabled} label={t('audio.back15')}>
          <View style={[ctl(), disabled && { opacity: 0.4 }]}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: C.ink }}>−15</Text>
          </View>
        </Tap>
        <Tap onPress={onPlay} disabled={disabled} label={playing ? t('audio.pause') : t('audio.play')}>
          <View
            testID="audio-play"
            accessibilityRole="button"
            // Read aloud in the app's language, not always English.
            accessibilityLabel={playing ? t('audio.pause') : t('audio.play')}
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
        <Tap onPress={() => onSeek(15)} disabled={disabled} label={t('audio.forward15')}>
          <View style={[ctl(), disabled && { opacity: 0.4 }]}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: C.ink }}>+15</Text>
          </View>
        </Tap>
      </Row>

      <Row style={{ justifyContent: 'center', marginTop: S.md, flexWrap: 'wrap' }} gap={S.sm}>
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
  const { state, actions, contentKey } = useApp();
  const t = useT();
  const online = useOnline();
  const download = useChapterDownload(id);

  // The recording to ask for is in the subject's own language: an Urdu or
  // Punjab Islamiyat lesson is Urdu for every student, English is English.
  const medium = subjectMedium(id, state.onboarding?.board, state.settings.contentMedium);
  const { data: tracks, loading: tracksLoading, error: tracksError } = useAsync(() => api.getAudioTracks(id), [id, contentKey]);
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
      title={lessonTitle(id, state.settings.language)}
      // The language of the recording actually playing, not the student's.
      subtitle={t(narration(picked?.medium ?? medium))}
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
          ? t(lessonNote(id, state.onboarding?.board))
          : tracksLoading
            ? t('common.loading')
            : // Offline the track list cannot be read, which is not the same
              // as a chapter with no recording.
              tracksError || !online
              ? t('audio.loadFailed')
              : t('audio.noTrackNote')
      }
      downloaded={download.readable}
      offlineAudio={!!offlineUri}
      busy={download.busy}
      onToggleDownload={download.press}
      confirm={download.confirm}
    />
  );
}

/**
 * Shown when the installed binary has no audio support yet. The screen still
 * works, the transport just runs on a timer, so a dev build from before the
 * module was added keeps every other screen usable.
 */
function PreviewPlayer({ id }: { id: string }) {
  const { state } = useApp();
  const t = useT();
  const download = useChapterDownload(id);
  const medium = subjectMedium(id, state.onboarding?.board, state.settings.contentMedium);

  // This boundary only exists for binaries that predate expo-audio, and it
  // cannot play anything. A made-up "14 minutes" was worse than saying so.
  const duration = 0;
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Any lesson on disk, in either language slot. Asked by the recording's
  // medium, an Urdu lesson saved by an English-medium student read as absent.
  const onDisk = useMemo(() => download.listed && localAudioTrack(id, medium) !== null, [download.listed, id, medium]);

  useEffect(() => {
    if (playing) timer.current = setInterval(() => setPosition((p) => Math.min(duration, p + SPEEDS[speed])), 1000);
    else if (timer.current) clearInterval(timer.current);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, speed, duration]);

  return (
    <PlayerChrome
      title={lessonTitle(id, state.settings.language)}
      subtitle={t(narration(medium))}
      position={position}
      duration={duration}
      playing={playing}
      speed={speed}
      onPlay={() => setPlaying((p) => !p)}
      onSeek={(d) => setPosition((p) => Math.max(0, Math.min(duration, p + d)))}
      onSpeed={() => setSpeed((s) => (s + 1) % SPEEDS.length)}
      note={t('audio.needsNewBuild')}
      downloaded={download.readable}
      offlineAudio={onDisk}
      busy={download.busy}
      onToggleDownload={download.press}
      confirm={download.confirm}
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
