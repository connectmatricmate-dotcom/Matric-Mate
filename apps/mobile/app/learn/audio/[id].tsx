import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { requireOptionalNativeModule } from 'expo';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { ErrorBoundary } from '../../../src/components/ErrorBoundary';
import { Icon } from '../../../src/components/Icon';
import { Bar, Btn, Card, H2, Header, IconButton, Pill, Row, Screen, Small, Spacer, Tap, Text } from '../../../src/components/ui';
import { api, chapterById, chapterName, fetchVoiceStream, isOneLanguageSubject, pickAudioTrack, subjectMedium } from '@matricmate/core';
import type { Medium, VoiceStream } from '@matricmate/core';
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
import { setListening } from '../../../src/core/studyClock';

const SPEEDS = [1, 1.25, 1.5] as const;

/** The app icon on the lock screen. Offline it simply does not load, and the controls still work. */
const LOCK_SCREEN_ART = 'https://www.matricmate.co/brand/icon-512.png';

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

/**
 * What is playing instead of the track's own file, for a lesson whose premium
 * voice is still being made (Islamiyat, Urdu, other Islamic content). The
 * website's player does the same (AudioLesson.tsx).
 *
 * A stream is the lesson made as it plays: it cannot be skipped through, and
 * its clock starts at `offset`, where it was asked to start. A file is the
 * finished lesson, swapped in the moment it exists so skipping works again.
 */
type Voice = { uri: string; stream: boolean; offset: number; estSecs: number; fileSecs?: number };

/** How long a play press waits for the stream before playing the file it has. */
const ASK_MS = 8000;
/** While streaming, how often to look for the finished file. */
const POLL_MS = 20_000;

const askVoice = (chapterId: string, medium: Medium, at: number): Promise<VoiceStream | null> =>
  Promise.race([fetchVoiceStream(chapterId, medium, at), new Promise<null>((r) => setTimeout(() => r(null), ASK_MS))]);

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
  making,
  asking,
  note,
  downloaded,
  offlineAudio,
  busy,
  onToggleDownload,
  confirm,
  onRetry,
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
  /** The lesson is being made as it plays: no skipping, and 1x only. */
  making?: boolean;
  /** The play press is waiting for the lesson's stream. */
  asking?: boolean;
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
  /** Set when the lesson failed to play: a Retry under the note. */
  onRetry?: () => void;
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
              // Said aloud: an icon alone was read as "button".
              label={t(downloaded ? 'study.removeOffline' : 'study.saveOffline')}
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
        <Tap onPress={() => onSeek(-15)} disabled={disabled || making} label={t('audio.back15')}>
          <View style={[ctl(), (disabled || making) && { opacity: 0.4 }]}>
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
            {asking ? (
              <ActivityIndicator size="large" color={C.onBrand} />
            ) : (
              <Icon name={playing ? 'pause' : 'play'} size={30} color={C.onBrand} strokeWidth={2.2} />
            )}
          </View>
        </Tap>
        <Tap onPress={() => onSeek(15)} disabled={disabled || making} label={t('audio.forward15')}>
          <View style={[ctl(), (disabled || making) && { opacity: 0.4 }]}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: C.ink }}>+15</Text>
          </View>
        </Tap>
      </Row>

      <Row style={{ justifyContent: 'center', marginTop: S.md, flexWrap: 'wrap' }} gap={S.sm}>
        <Pill tone="grey" onPress={disabled || making ? undefined : onSpeed} style={making ? { opacity: 0.45 } : undefined}>
          {t('audio.speed', { n: SPEEDS[speed] })}
        </Pill>
        <Pill tone={offlineAudio ? 'green' : 'grey'} icon={offlineAudio ? 'check' : 'download'}>
          {offlineAudio ? t('audio.offline') : t('audio.stream')}
        </Pill>
      </Row>

      <Card flat tint={disabled || onRetry ? C.orangeTint : C.tealTint} style={{ marginTop: S.lg }}>
        <Small>{note}</Small>
        {/* A lesson that failed to load, or dropped part way, gets a way on:
            the player went quiet and Play did nothing. */}
        {onRetry ? (
          <>
            <Spacer h={S.sm} />
            <Btn title={t('common.retry')} variant="line" sm icon="refresh" onPress={onRetry} />
          </>
        ) : null}
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
  // Unless the lesson got its new voice after it was saved: online, the new
  // one plays. Offline, the saved copy is still the lesson.
  const stale = !!(online && localTrack && picked && picked !== localTrack && picked.storagePath !== localTrack.storagePath);

  const [voice, setVoice] = useState<Voice | null>(null);
  const [asking, setAsking] = useState(false);
  const streaming = !!voice?.stream;
  /** Where to put the playhead, and whether to play, once the next source loads. */
  const resume = useRef<{ at: number; play: boolean } | null>(null);
  /** The stream is asked for once per visit; after that the answer stands. */
  const asked = useRef(false);
  /** The last point a stream was asked again from, and how often: the same point twice means it is not moving. */
  const retry = useRef({ at: -1, count: 0 });
  // Another lesson or language is a fresh start. Adjusted during render so the
  // old lesson's stream is never handed to the new one's player.
  const lessonKey = `${id}|${medium}`;
  const [loadedLesson, setLoadedLesson] = useState(lessonKey);
  if (lessonKey !== loadedLesson) {
    setLoadedLesson(lessonKey);
    setVoice(null);
    setAsking(false);
  }
  useEffect(() => {
    asked.current = false;
    resume.current = null;
    retry.current = { at: -1, count: 0 };
  }, [lessonKey]);
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
  const fileUri = offlineUri && !stale ? offlineUri : remoteUri;
  // The stream is set as the source only by a press: expo-audio starts
  // loading a source the moment it has one, and loading it is what makes it.
  const uri = voice?.uri ?? fileUri;
  const track = useMemo(() => (uri ? { uri } : null), [uri]);
  const player = useAudioPlayer(track);

  /*
   * The status of this player, not the last one. The hook keeps the previous
   * player's last event until the new player sends one of its own, and a
   * stopped player sends none: after a stream ended early, that stale "just
   * finished" at X made the new stream player ask to carry on from X + X, so
   * the clock doubled and the lesson skipped ahead or stopped. An event from
   * another player is read past for the new one's current state.
   */
  const heard = useAudioPlayerStatus(player);
  const status = heard.id === player.id ? heard : player.currentStatus;
  // Listening counts as study time even with the screen untouched (core/studyClock.ts).
  useEffect(() => {
    setListening(status.playing);
    return () => setListening(false);
  }, [status.playing]);
  const [speed, setSpeed] = useState(0);
  const title = lessonTitle(id, state.settings.language);

  // 'doNotMix' because the lock-screen controls below only attach to a player
  // that holds audio focus on its own.
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch(() => {});
  }, []);

  /**
   * Lock-screen controls, which are also what keeps a lesson playing.
   *
   * Without them Android stops background audio after about three minutes, so
   * a student who locked the phone lost the lesson a few minutes in. Switched
   * on at the first play rather than on open, so opening a lesson does not
   * post a notification for audio nobody started. A new player (another
   * medium, or the downloaded copy) starts unregistered, and releasing the
   * old one on the way out takes its controls with it.
   */
  const onLockScreen = useRef(false);
  useEffect(() => {
    onLockScreen.current = false;
  }, [player]);
  useEffect(() => {
    if (!status.playing || onLockScreen.current) return;
    onLockScreen.current = true;
    try {
      // No skipping from the lock screen through a lesson being made as it
      // plays, as in the app (the -15 and +15 are off): seeking a stream
      // restarts it. The finished file is a new player, registered afresh.
      player.setActiveForLockScreen(
        true,
        { title, artist: 'MatricMate', artworkUrl: LOCK_SCREEN_ART },
        { showSeekBackward: !streaming, showSeekForward: !streaming },
      );
    } catch {
      // A binary without the playback service still plays in the foreground.
    }
  }, [status.playing, player, title, streaming]);

  // A new player starts at 1x, but the speed pill keeps its state across a
  // source switch. Re-applied whenever either changes, so they cannot drift.
  // A lesson being made as it plays is heard at 1x only: faster than that
  // could overtake the voice making it.
  useEffect(() => {
    player.setPlaybackRate(streaming ? 1 : SPEEDS[speed]);
  }, [player, speed, streaming]);

  // Until the file's own metadata arrives, the row's measured duration is the
  // truth. audioMinutes on the chapter row is a summary for the lists. A
  // stream has no length until it is over: the lesson's estimated one.
  const duration = streaming ? (voice?.estSecs ?? 0) : status.duration || voice?.fileSecs || picked?.durationSecs || 0;
  const position = (streaming ? (voice?.offset ?? 0) : 0) + (status.currentTime || 0);

  /*
   * A file that would not load, or that dropped part way (mobile data going,
   * the most likely case). Only the stream's errors were handled: a file's
   * left a quiet player whose Play did nothing, since a player that has
   * failed does not load again by itself. Said, with a Retry that loads the
   * same file again and carries on from where it stopped.
   */
  const fileFailed = !streaming && !!track && !!status.error;
  const reached = useRef(0);
  useEffect(() => {
    if (status.currentTime > 0) reached.current = status.currentTime;
  }, [status.currentTime]);
  useEffect(() => {
    reached.current = 0;
  }, [uri]);
  const [reloads, setReloads] = useState(0);
  const retryFile = () => {
    if (!track) return;
    resume.current = { at: reached.current, play: true };
    player.replace(track);
    setReloads((n) => n + 1);
  };

  // A new source (the stream, or the finished file swapped in) plays as soon
  // as it can when the press or the swap asked for it; a file seeks first.
  useEffect(() => {
    const r = resume.current;
    if (!r) return;
    if (!streaming && !status.isLoaded) return;
    if (!streaming && r.at > 0) player.seekTo(r.at);
    if (r.play) player.play();
    resume.current = null;
  }, [player, status.isLoaded, streaming, reloads]);

  /**
   * The lesson from `at` seconds in, after a stream stopped: the finished
   * file when it exists (at the same point, since the stream is made of the
   * very same parts), more of the stream when it is still being made, and
   * the old recording at about the same point when neither can be had, so a
   * student is never left with silence mid-lesson.
   */
  const carryOn = useCallback(
    async (at: number) => {
      if (!picked || !voice) return;
      if (Math.abs(retry.current.at - at) < 2) retry.current.count += 1;
      else retry.current = { at, count: 1 };
      const r = retry.current.count > 2 || !online ? null : await askVoice(picked.chapterId, picked.medium, at);
      if (r?.url) {
        const end = !!r.durationSecs && at >= r.durationSecs - 3;
        resume.current = end ? null : { at, play: true };
        setVoice({ uri: r.url, stream: false, offset: 0, estSecs: 0, fileSecs: r.durationSecs });
      } else if (r?.stream) {
        resume.current = { at: 0, play: true };
        setVoice({ uri: r.stream, stream: true, offset: at, estSecs: r.estSecs || voice.estSecs });
      } else if (r?.reason === 'end') {
        // It was the end of the lesson. The next press asks afresh, and by then it is a file.
        asked.current = false;
        resume.current = null;
        setVoice(null);
      } else if (fileUri) {
        const ratio = voice.estSecs ? Math.min(1, at / voice.estSecs) : 0;
        resume.current = { at: Math.max(0, ratio * (picked.durationSecs || 0) - 3), play: true };
        setVoice({ uri: fileUri, stream: false, offset: 0, estSecs: 0 });
      }
    },
    [picked, voice, online, fileUri],
  );

  // A stream ends at the end of the lesson, or early (its time ran out, the
  // connection dropped, which the player reports as an error): ask again from
  // here to find out which. Once per player: the flag stays up after the end.
  const ended = status.didJustFinish || !!status.error;
  const endHandled = useRef<unknown>(null);
  useEffect(() => {
    if (!ended || !streaming || !voice || endHandled.current === player) return;
    endHandled.current = player;
    void carryOn(voice.offset + (status.currentTime || 0));
  }, [ended, streaming, voice, player, carryOn, status.currentTime]);

  // While the lesson streams, look now and then for the finished file, and
  // move to it at the same point: from then on the seek buttons work.
  const now = useRef({ position, playing: status.playing, uri: voice?.uri });
  useEffect(() => {
    now.current = { position, playing: status.playing, uri: voice?.uri };
  });
  useEffect(() => {
    if (!streaming || !status.playing || !picked) return;
    const streamUri = voice?.uri;
    const timer = setInterval(async () => {
      const r = await fetchVoiceStream(picked.chapterId, picked.medium);
      if (!r?.url || now.current.uri !== streamUri) return;
      resume.current = { at: now.current.position, play: now.current.playing };
      setVoice({ uri: r.url, stream: false, offset: 0, estSecs: 0, fileSecs: r.durationSecs });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [streaming, status.playing, picked, voice?.uri]);

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
      title={title}
      // The language of the recording actually playing, not the student's.
      subtitle={t(narration(picked?.medium ?? medium))}
      position={position}
      duration={duration}
      playing={status.playing}
      speed={speed}
      disabled={!track}
      making={streaming}
      asking={asking}
      onPlay={async () => {
        if (!track || asking) return;
        // A failed file does not load again on play: Play is a retry too.
        if (fileFailed) {
          retryFile();
          return;
        }
        if (status.playing) {
          player.pause();
          return;
        }
        // The first press on a lesson whose new voice is still being made
        // asks for it. Asked here and not on opening, because asking starts it
        // being made, and a student who opens the lesson and leaves should
        // cost nothing. Offline there is no stream: the file it has plays.
        if (picked?.voicePending && online && !voice && !asked.current) {
          asked.current = true;
          setAsking(true);
          const r = await askVoice(picked.chapterId, picked.medium, 0);
          setAsking(false);
          if (r?.stream) {
            resume.current = { at: 0, play: true };
            setSpeed(0);
            setVoice({ uri: r.stream, stream: true, offset: 0, estSecs: r.estSecs || picked.durationSecs });
            return;
          }
          if (r?.url) {
            resume.current = { at: 0, play: true };
            setVoice({ uri: r.url, stream: false, offset: 0, estSecs: 0, fileSecs: r.durationSecs });
            return;
          }
        }
        if (status.didJustFinish) player.seekTo(0);
        player.play();
      }}
      onSeek={(d) => {
        if (!streaming) player.seekTo(Math.max(0, Math.min(duration, position + d)));
      }}
      onSpeed={() => setSpeed((n) => (n + 1) % SPEEDS.length)}
      /**
       * Three different states, and they used to render as one.
       *
       * While the track list is still being fetched there is no URL yet, so the
       * screen showed "no recording for this chapter" over dead controls, for a
       * chapter that has one. A slow request looked exactly like a missing
       * lesson. A failed request looked like one too, silently.
       */
      onRetry={fileFailed ? retryFile : undefined}
      note={
        streaming
          ? t('audio.voiceMaking')
          : fileFailed
          ? t('audio.loadFailed')
          : track
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
      offlineAudio={!!offlineUri && uri === offlineUri}
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
function PreviewPlayer({ id, onRetry }: { id: string; onRetry?: () => void }) {
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
      note={onRetry ? t('audio.loadFailed') : t('audio.needsNewBuild')}
      downloaded={download.readable}
      offlineAudio={onDisk}
      busy={download.busy}
      onToggleDownload={download.press}
      confirm={download.confirm}
      onRetry={onRetry}
    />
  );
}

/**
 * Whether this binary has the audio module at all. Only a build older than
 * audio support lacks it; in any other the fallback means the player itself
 * failed, and "install the latest build" was advice that could not help.
 */
const HAS_AUDIO = requireOptionalNativeModule('ExpoAudio') != null;

export default function AudioLesson() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ErrorBoundary fallback={(reset) => (HAS_AUDIO ? <PreviewPlayer id={id} onRetry={reset} /> : <PreviewPlayer id={id} />)}>
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
