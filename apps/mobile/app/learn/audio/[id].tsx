import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { Icon } from '../../../src/components/Icon';
import { Bar, Card, H2, Header, IconButton, Pill, Row, Screen, Small, Spacer, Tap, useToast } from '../../../src/components/ui';
import { api } from '../../../src/core/api';
import { AUDIO_TRACKS } from '../../../src/core/content';
import { useAsync } from '../../../src/core/useAsync';
import { useT } from '../../../src/i18n';
import { useApp } from '../../../src/store/app';
import { C, F, S } from '../../../src/theme';

const SPEEDS = [1, 1.25, 1.5] as const;

export default function AudioLesson() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, actions } = useApp();
  const t = useT();
  const toast = useToast();
  const { data: chapter } = useAsync(() => api.getChapter(id), [id]);
  const { data: content } = useAsync(() => api.getChapterContent(id), [id]);

  const medium = state.settings.contentMedium;
  const track = AUDIO_TRACKS[id]?.[medium] ?? AUDIO_TRACKS[id]?.en;
  const player = useAudioPlayer(track ?? null);
  const status = useAudioPlayerStatus(player);
  const [speed, setSpeed] = useState(0);
  const downloaded = state.downloads.includes(id);

  // Keep playing when the screen locks or the app goes to the background.
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true }).catch(() => {});
  }, []);

  // Switching medium swaps the recording, so start the new one from the top.
  useEffect(() => {
    if (track) player.replace(track);
  }, [track]); // eslint-disable-line react-hooks/exhaustive-deps

  const duration = status.duration || (chapter?.audioMinutes ?? 14) * 60;
  const position = status.currentTime || 0;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  function seek(delta: number) {
    player.seekTo(Math.max(0, Math.min(duration, position + delta)));
  }

  function cycleSpeed() {
    const next = (speed + 1) % SPEEDS.length;
    setSpeed(next);
    player.setPlaybackRate(SPEEDS[next]);
  }

  return (
    <Screen>
      <Header
        title={t('audio.title')}
        back
        right={
          <IconButton
            icon={downloaded ? 'check' : 'download'}
            tone={downloaded ? 'active' : 'card'}
            onPress={() => {
              actions.toggleDownload(id);
              toast(downloaded ? t('study.removedOffline') : t('study.saveOffline'));
            }}
          />
        }
      />

      <View style={{ alignItems: 'center', marginTop: S.md }}>
        <View style={{ width: 210, height: 210, borderRadius: 24, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' }}>
          <Image source={require('../../../assets/monogram.png')} style={{ width: 130, height: 100 }} resizeMode="contain" />
        </View>
        <H2 style={{ marginTop: S.md, textAlign: 'center' }}>{content?.audioTitle ?? ''}</H2>
        <Small style={{ textAlign: 'center' }}>
          {medium === 'ur' ? t('audio.narrationUr') : t('audio.narrationEn')}
        </Small>
      </View>

      <Spacer h={S.lg} />
      <Bar pct={duration ? (position / duration) * 100 : 0} tone="teal" />
      <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
        <Small style={{ fontFamily: F.bodyBold }}>{fmt(position)}</Small>
        <Small style={{ fontFamily: F.bodyBold }}>{fmt(duration)}</Small>
      </Row>

      <Row style={{ justifyContent: 'center', marginTop: S.lg }} gap={S.xl}>
        <Tap onPress={() => seek(-15)}>
          <View style={ctl}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: C.ink }}>−15</Text>
          </View>
        </Tap>
        <Tap
          onPress={() => {
            if (!track) return;
            if (status.playing) player.pause();
            else {
              if (status.didJustFinish) player.seekTo(0);
              player.play();
            }
          }}
        >
          <View
            testID="audio-play"
            accessibilityRole="button"
            accessibilityLabel={status.playing ? 'Pause' : 'Play'}
            style={{ width: 76, height: 76, borderRadius: 99, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name={status.playing ? 'pause' : 'play'} size={30} color="#fff" strokeWidth={2.2} />
          </View>
        </Tap>
        <Tap onPress={() => seek(15)}>
          <View style={ctl}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: C.ink }}>+15</Text>
          </View>
        </Tap>
      </Row>

      <Row style={{ justifyContent: 'center', marginTop: S.md }} gap={S.sm}>
        <Pill tone="grey" onPress={cycleSpeed}>
          {t('audio.speed', { n: SPEEDS[speed] })}
        </Pill>
        <Pill tone={downloaded ? 'green' : 'grey'} icon={downloaded ? 'check' : 'download'}>
          {downloaded ? t('audio.offline') : t('audio.stream')}
        </Pill>
        {!status.isLoaded ? <Pill tone="grey">{t('common.loading')}</Pill> : null}
      </Row>

      <Card flat tint={C.tealTint} style={{ marginTop: S.lg }}>
        <Small>{t('audio.sampleNote')}</Small>
      </Card>
    </Screen>
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
