import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '../../src/components/AppHeader';
import { Icon, SUBJECT_ICON } from '../../src/components/Icon';
import { Card, Empty, ErrorState, Ring, Row, Screen, Skeleton, Small, Ur } from '../../src/components/ui';
import { api , hasStudyMaterial, subjectPct , SUBJECT_COLORS } from '@matricmate/core';
import { useAsync } from '../../src/core/useAsync';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, S, isWeb } from '../../src/theme';

export default function Study() {
  const { state, derived } = useApp();
  const t = useT();
  const [q, setQ] = useState('');
  // One fetch for both: a subject list without its chapters can't render a
  // chapter count or a "continue" chapter, so there's nothing useful to show
  // until both have arrived. Keeping them on one `loading` flag is what stops
  // the list flashing empty between "subjects in" and "chapters in".
  const { data: subjects, loading, error, reload } = useAsync(async () => {
    const list = await api.getSubjects(derived.subjects);
    const chapters = await Promise.all(list.map((s) => api.getChapters(s.id)));
    return list.map((s, i) => ({ s, chapters: chapters[i] }));
  }, [derived.subjects.join()]);

  const rows = useMemo(() => {
    if (!subjects) return [];
    const needle = q.trim().toLowerCase();
    return subjects
      .map(({ s, chapters }) => {
        const pct = subjectPct(s.id, state.readSections, state.attempts);
        // Skip chapters with nothing to study: pointing "Continue" at an
        // empty chapter would send a student straight to a dead end.
        const next = chapters.find((c) => c.id === state.lastChapterId) ?? chapters.find(hasStudyMaterial);
        return { s, pct, next, chapters };
      })
      .filter(({ s, chapters }) =>
        !needle
          ? true
          : s.name.toLowerCase().includes(needle) || chapters.some((c) => c.title.toLowerCase().includes(needle))
      );
  }, [subjects, q, state.readSections, state.attempts, state.lastChapterId]);

  const setup = state.onboarding;
  const eyebrow = setup
    ? t('study.setupLine', {
        class: setup.classLevel,
        board: setup.board === 'fbise' ? 'FBISE' : 'Punjab Board',
        medium: setup.medium === 'en' ? 'English' : 'Urdu',
      })
    : undefined;

  return (
    <Screen tabbed>
      <AppHeader eyebrow={eyebrow} title={t('study.title')} showStreak={false} />

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
          paddingVertical: 13,
          marginBottom: S.md,
        }}
      >
        <Icon name="search" size={18} color={C.ink3} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={t('study.searchPlaceholder')}
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
      ) : error && rows.length === 0 ? (
        // A network failure used to fall through to "no search results",
        // which tells a student to retype instead of to reconnect.
        <ErrorState title={t('states.errorTitle')} sub={t('states.errorBody')} retry={t('common.retry')} onRetry={reload} />
      ) : rows.length === 0 ? (
        <Empty emoji="🔍" title={t('study.noMatchTitle')} sub={t('study.noMatchBody', { q })} />
      ) : (
        <View style={{ gap: S.md }}>
          {rows.map(({ s, pct, next, chapters }) => (
            <Card key={s.id} onPress={() => router.push(`/learn/subject/${s.id}`)}>
              <Row gap={S.md}>
                <Ring
                  pct={pct}
                  color={SUBJECT_COLORS[s.id]?.main ?? C.teal}
                  fill={SUBJECT_COLORS[s.id]?.tint ?? C.tealTint}
                >
                  <Icon name={SUBJECT_ICON[s.id] ?? 'book'} size={19} color={SUBJECT_COLORS[s.id]?.main ?? C.teal} strokeWidth={2.3} />
                </Ring>
                <View style={{ flex: 1, minWidth: 0 }}>
                  {/* One language at a time: the app language picks the name. */}
                  {state.settings.language === 'ur' && s.urduName ? (
                    <Ur size={15}>{s.urduName}</Ur>
                  ) : (
                    <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.ink }}>{s.name}</Text>
                  )}
                  <Small>
                    {t('study.chapterCount', { n: chapters.length })} · {t('study.percentComplete', { n: pct })}
                  </Small>
                  {next ? (
                    <Text style={{ fontFamily: F.bodyBold, fontSize: 12, color: C.teal, marginTop: 2 }} numberOfLines={1}>
                      {t('study.continueChapter', { chapter: next.title })}
                    </Text>
                  ) : null}
                </View>
                <Icon name="chevron" size={18} color={C.ink3} />
              </Row>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
