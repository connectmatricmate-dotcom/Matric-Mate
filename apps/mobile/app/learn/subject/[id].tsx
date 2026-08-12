import { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '../../../src/components/Icon';
import { Bar, Btn, Card, ErrorState, Header, Pill, Row, Screen, Sheet, Skeleton, Small, Spacer, Ur } from '../../../src/components/ui';
import { LockedNotice } from '../../../src/components/LockedNotice';
import { api , chapterPct, hasStudyMaterial, subjectPct } from '@matricmate/core';
import { useAsync } from '../../../src/core/useAsync';
import { useT } from '../../../src/i18n';
import { useApp } from '../../../src/store/app';
import { C, F, S } from '../../../src/theme';

export default function Chapters() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useApp();
  const t = useT();
  const { data: subject } = useAsync(() => api.getSubject(id), [id]);
  const { data: chapters, loading, error, reload } = useAsync(() => api.getChapters(id), [id]);
  const [showLocked, setShowLocked] = useState(false);

  const pct = subjectPct(id, state.readSections, state.attempts);

  return (
    <Screen
      footer={
        <Btn
          title={t('study.chapterTest')}
          variant="orange"
          icon="clock"
          onPress={() => router.push(`/session/exam-intro?subject=${id}`)}
        />
      }
    >
      <Header
        title={subject?.name ?? ''}
        sub={
          chapters
            ? `${t('study.chapterCount', { n: chapters.length })} · ${t('study.percentComplete', { n: pct })}`
            : ' '
        }
        back
      />

      {loading ? (
        <View style={{ gap: S.sm }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Card key={i} flat>
              <Row gap={S.md}>
                <Skeleton w={38} h={38} />
                <View style={{ flex: 1, gap: 7 }}>
                  <Skeleton w="70%" h={13} />
                  <Skeleton w="45%" h={10} />
                </View>
              </Row>
            </Card>
          ))}
        </View>
      ) : error && !(chapters ?? []).length ? (
        <ErrorState title={t('states.errorTitle')} sub={t('states.errorBody')} retry={t('common.retry')} onRetry={reload} />
      ) : (
        <View style={{ gap: S.sm }}>
          {(chapters ?? []).map((c) => {
            const empty = !hasStudyMaterial(c);
            const p = empty ? 0 : chapterPct(c.id, state.readSections, state.attempts);
            const locked = c.premium && !state.premium.active;
            const current = c.id === state.lastChapterId;
            const done = p >= 100;
            return (
              <Card
                key={c.id}
                flat={!current}
                border={current ? C.teal : undefined}
                style={{ opacity: empty || locked ? 0.62 : 1 }}
                onPress={empty ? undefined : () => (locked ? setShowLocked(true) : router.push(`/learn/chapter/${c.id}`))}
              >
                <Row gap={S.md}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: empty ? C.grey : done ? C.greenTint : C.tealTint,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {done ? (
                      <Icon name="check" size={19} color={C.green} strokeWidth={2.6} />
                    ) : (
                      <Text style={{ fontFamily: F.display, fontSize: 16, color: empty ? C.ink3 : C.teal }}>{c.number}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    {c.urduTitle ? <Ur size={15}>{c.urduTitle}</Ur> : null}
                    <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.ink }}>{c.title}</Text>
                    {empty ? (
                      <Small>{c.blurb}</Small>
                    ) : (
                      <Small numberOfLines={1}>
                        {/* Only what the row actually knows. audioMinutes is
                            always zero here; the real length lives on the
                            audio_tracks row and belongs to the chapter hub. */}
                        {t('study.mcqsSub', { n: c.mcqCount })} · {t('study.sectionsSub', { n: c.sectionCount })}
                      </Small>
                    )}
                    {!empty && p > 0 && p < 100 ? (
                      <View style={{ marginTop: 7 }}>
                        <Bar pct={p} tone="teal" />
                      </View>
                    ) : null}
                  </View>
                  {empty ? (
                    <Pill tone="grey">{t('study.notOnPaper')}</Pill>
                  ) : locked ? (
                    <Pill tone="grey" icon="lock">
                      {t('study.premiumChapter')}
                    </Pill>
                  ) : current ? (
                    <Pill tone="orange">{t('common.continue')}</Pill>
                  ) : (
                    <Icon name="chevron" size={18} color={C.ink3} />
                  )}
                </Row>
              </Card>
            );
          })}
        </View>
      )}
      <Spacer h={S.md} />
      <Small>{t('study.premiumNote')}</Small>

      <Sheet visible={showLocked} onClose={() => setShowLocked(false)} title={t('billing.premium')}>
        <LockedNotice variant="locked" />
        <Spacer h={S.md} />
        <Btn title={t('common.close')} variant="line" onPress={() => setShowLocked(false)} />
      </Sheet>
    </Screen>
  );
}
