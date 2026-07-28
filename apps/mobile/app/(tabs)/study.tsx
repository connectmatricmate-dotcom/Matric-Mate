import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '../../src/components/AppHeader';
import { Icon } from '../../src/components/Icon';
import { Card, Empty, Ring, Row, Screen, Skeleton, Small, Spacer, Ur } from '../../src/components/ui';
import { api } from '../../src/core/api';
import { subjectPct } from '../../src/core/domain';
import { useAsync } from '../../src/core/useAsync';
import { CHAPTERS } from '../../src/core/content';
import { useApp } from '../../src/store/app';
import { C, F, S, isWeb } from '../../src/theme';

export default function Study() {
  const { state, derived } = useApp();
  const [q, setQ] = useState('');
  const { data: subjects, loading } = useAsync(() => api.getSubjects(derived.subjects), [derived.subjects.join()]);

  const rows = useMemo(() => {
    if (!subjects) return [];
    const needle = q.trim().toLowerCase();
    return subjects
      .map((s) => {
        const chapters = CHAPTERS[s.id] ?? [];
        const pct = subjectPct(s.id, state.readSections, state.attempts);
        const next = chapters.find((c) => c.id === state.lastChapterId) ?? chapters[0];
        return { s, pct, next, chapters };
      })
      .filter(({ s, chapters }) =>
        !needle
          ? true
          : s.name.toLowerCase().includes(needle) || chapters.some((c) => c.title.toLowerCase().includes(needle))
      );
  }, [subjects, q, state.readSections, state.attempts, state.lastChapterId]);

  const setup = state.onboarding;

  return (
    <Screen>
      <AppHeader
        eyebrow={setup ? `Class ${setup.classLevel} · ${setup.board === 'fbise' ? 'FBISE' : 'Punjab Board'} · ${setup.medium === 'en' ? 'English' : 'Urdu'} medium` : undefined}
        title="Study"
        showStreak={false}
      />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: S.sm,
          backgroundColor: C.card,
          borderWidth: 1.5,
          borderColor: C.line,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 12,
          marginBottom: S.md,
        }}
      >
        <Icon name="search" size={18} color={C.ink3} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search subject or chapter"
          placeholderTextColor={C.ink3}
          style={[
            { flex: 1, fontFamily: F.body, fontSize: 15, color: C.ink, paddingVertical: 0 },
            isWeb && ({ outlineStyle: 'none' } as object),
          ]}
        />
      </View>

      {loading ? (
        <View style={{ gap: S.md }}>
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} flat>
              <Row gap={S.md}>
                <Skeleton w={54} h={54} style={{ borderRadius: 99 }} />
                <View style={{ flex: 1, gap: 7 }}>
                  <Skeleton w="60%" h={14} />
                  <Skeleton w="40%" h={11} />
                </View>
              </Row>
            </Card>
          ))}
        </View>
      ) : rows.length === 0 ? (
        <Empty emoji="🔍" title="Nothing matched" sub={`No subject or chapter for “${q}”.`} />
      ) : (
        <View style={{ gap: S.md }}>
          {rows.map(({ s, pct, next, chapters }) => (
            <Card key={s.id} onPress={() => router.push(`/learn/subject/${s.id}`)}>
              <Row gap={S.md}>
                <Ring pct={pct}>
                  <Icon name={s.icon} size={18} color={C.teal} />
                </Ring>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Row gap={6}>
                    <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.ink }}>{s.name}</Text>
                    {s.urduName ? <Ur size={13} style={{ color: C.ink2 }}>{s.urduName}</Ur> : null}
                  </Row>
                  <Small>
                    {chapters.length} chapters · {pct}% complete
                  </Small>
                  {next ? (
                    <Text style={{ fontFamily: F.bodyBold, fontSize: 12, color: C.teal, marginTop: 2 }} numberOfLines={1}>
                      Continue: Ch {next.number} · {next.title}
                    </Text>
                  ) : null}
                </View>
                <Icon name="chevron" size={18} color={C.ink3} />
              </Row>
            </Card>
          ))}
        </View>
      )}
      <Spacer h={S.xl} />
    </Screen>
  );
}
