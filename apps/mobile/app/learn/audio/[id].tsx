import { useEffect, useRef, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Icon } from '../../../src/components/Icon';
import { Bar, Card, H2, Header, IconButton, Pill, Row, Screen, Small, Spacer, Tap, useToast } from '../../../src/components/ui';
import { api } from '../../../src/core/api';
import { useAsync } from '../../../src/core/useAsync';
import { useT } from '../../../src/i18n';
import { useApp } from '../../../src/store/app';
import { C, F, S } from '../../../src/theme';

const SPEEDS = [1, 1.25, 1.5] as const;

/** Transport is simulated in this build; real playback ships with the client's audio. */
export default function AudioLesson() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, actions } = useApp();
  const t = useT();
  const toast = useToast();
  const { data: chapter } = useAsync(() => api.getChapter(id), [id]);
  const { data: content } = useAsync(() => api.getChapterContent(id), [id]);

  const total = (chapter?.audioMinutes ?? 14) * 60;
  const [pos, setPos] = useState(Math.round(total * 0.35));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const downloaded = state.downloads.includes(id);

  useEffect(() => {
    if (playing) {
      timer.current = setInterval(() => setPos((p) => Math.min(total, p + SPEEDS[speed])), 1000);
    } else if (timer.current) {
      clearInterval(timer.current);
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, speed, total]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

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
          {chapter ? t('study.audioSub', { n: chapter.audioMinutes }) : ''}
        </Small>
      </View>

      <Spacer h={S.lg} />
      <Bar pct={(pos / total) * 100} tone="teal" />
      <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
        <Small style={{ fontFamily: F.bodyBold }}>{fmt(pos)}</Small>
        <Small style={{ fontFamily: F.bodyBold }}>{fmt(total)}</Small>
      </Row>

      <Row style={{ justifyContent: 'center', marginTop: S.lg }} gap={S.xl}>
        <Tap onPress={() => setPos((p) => Math.max(0, p - 15))}>
          <View style={ctl}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: C.ink }}>−15</Text>
          </View>
        </Tap>
        <Tap onPress={() => setPlaying((p) => !p)}>
          <View style={{ width: 76, height: 76, borderRadius: 99, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={playing ? 'pause' : 'play'} size={30} color="#fff" strokeWidth={2.2} />
          </View>
        </Tap>
        <Tap onPress={() => setPos((p) => Math.min(total, p + 15))}>
          <View style={ctl}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: C.ink }}>+15</Text>
          </View>
        </Tap>
      </Row>

      <Row style={{ justifyContent: 'center', marginTop: S.md }} gap={S.sm}>
        <Pill tone="grey" onPress={() => setSpeed((s) => (s + 1) % SPEEDS.length)}>
          {t('audio.speed', { n: SPEEDS[speed] })}
        </Pill>
        <Pill tone={downloaded ? 'green' : 'grey'} icon={downloaded ? 'check' : 'download'}>
          {downloaded ? t('audio.offline') : t('audio.stream')}
        </Pill>
      </Row>

      <Card flat tint={C.orangeTint} style={{ marginTop: S.lg }}>
        <Small>{t('audio.demoNote')}</Small>
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
