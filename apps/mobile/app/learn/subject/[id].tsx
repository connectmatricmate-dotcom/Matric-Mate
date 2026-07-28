import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '../../../src/components/Icon';
import {
  Bar,
  Btn,
  Card,
  Header,
  Pill,
  Ring,
  Row,
  Screen,
  Seg,
  Skeleton,
  Small,
  Spacer,
  Ur,
  useToast,
} from '../../../src/components/ui';
import { api } from '../../../src/core/api';
import { chapterPct, subjectPct } from '../../../src/core/domain';
import { useAsync } from '../../../src/core/useAsync';
import { Medium } from '../../../src/core/types';
import { useApp } from '../../../src/store/app';
import { C, F, S } from '../../../src/theme';

export default function Chapters() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, actions } = useApp();
  const toast = useToast();
  const { data: subject } = useAsync(() => api.getSubject(id), [id]);
  const { data: chapters, loading } = useAsync(() => api.getChapters(id), [id]);

  const pct = subjectPct(id, state.readSections, state.attempts);

  return (
    <Screen
      footer={
        <Btn
          title="Chapter test — 20 questions"
          variant="orange"
          icon="clock"
          onPress={() => router.push(`/session/exam-intro?subject=${id}`)}
        />
      }
    >
      <Header
        title={subject?.name ?? 'Chapters'}
        sub={chapters ? `${chapters.length} chapters · ${pct}% complete` : ' '}
        back
        right={
          <View style={{ width: 116 }}>
            <Seg<Medium>
              value={state.settings.contentMedium}
              onChange={(m) => {
                actions.setSettings({ contentMedium: m });
                toast(m === 'en' ? 'English content' : 'اردو مواد');
              }}
              options={[
                { value: 'en', label: 'EN' },
                { value: 'ur', label: 'اردو', urdu: true },
              ]}
            />
          </View>
        }
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
      ) : (
        <View style={{ gap: S.sm }}>
          {(chapters ?? []).map((c) => {
            const p = chapterPct(c.id, state.readSections, state.attempts);
            const locked = c.premium && !state.premium.active;
            const current = c.id === state.lastChapterId;
            const done = p >= 100;
            return (
              <Card
                key={c.id}
                flat={!current}
                border={current ? C.teal : undefined}
                style={{ opacity: locked ? 0.62 : 1 }}
                onPress={() => (locked ? router.push('/paywall') : router.push(`/learn/chapter/${c.id}`))}
              >
                <Row gap={S.md}>
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      backgroundColor: done ? C.greenTint : C.tealTint,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {done ? (
                      <Icon name="check" size={18} color={C.green} strokeWidth={2.6} />
                    ) : (
                      <Text style={{ fontFamily: F.display, fontSize: 16, color: C.teal }}>{c.number}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    {c.urduTitle ? <Ur size={15}>{c.urduTitle}</Ur> : null}
                    <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.ink }}>{c.title}</Text>
                    <Small numberOfLines={1}>
                      {c.mcqCount} MCQs · {c.audioMinutes} min audio · {c.flashcardCount} cards
                    </Small>
                    {p > 0 && p < 100 ? (
                      <View style={{ marginTop: 7 }}>
                        <Bar pct={p} tone="teal" />
                      </View>
                    ) : null}
                  </View>
                  {locked ? (
                    <Pill tone="grey" icon="lock">
                      Premium
                    </Pill>
                  ) : current ? (
                    <Pill tone="orange">Continue</Pill>
                  ) : (
                    <Icon name="chevron" size={18} color={C.ink3} />
                  )}
                </Row>
              </Card>
            );
          })}
        </View>
      )}
      <Spacer h={S.lg} />
      <Small>Chapters 7 and up are Premium in this demo, to show how locking works.</Small>
    </Screen>
  );
}
