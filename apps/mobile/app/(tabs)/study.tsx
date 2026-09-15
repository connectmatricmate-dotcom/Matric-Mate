import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '../../src/components/AppHeader';
import { Icon, SUBJECT_ICON } from '../../src/components/Icon';
import {
  Card,
  Chevron,
  Empty,
  ErrorState,
  Ring,
  Row,
  Screen,
  ScriptText,
  SectionTitle,
  Skeleton,
  Small,
  TextInput,
} from '../../src/components/ui';
import { SUBJECT_COLORS, api, boardName, chapterName, hasStudyMaterial, mediumName, subjectName, subjectPct } from '@matricmate/core';
import { useAsync } from '../../src/core/useAsync';
import { useLang, useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, S, isWeb, rowDir, textStart } from '../../src/theme';

export default function Study() {
  const { state, derived, contentKey } = useApp();
  const t = useT();
  const { lang } = useLang();
  const [q, setQ] = useState('');
  // One fetch for both: a subject list without its chapters can't render a
  // chapter count or a "continue" chapter, so there's nothing useful to show
  // until both have arrived. Keeping them on one `loading` flag is what stops
  // the list flashing empty between "subjects in" and "chapters in".
  // Keyed on contentKey as well as the subjects: a class, board or language
  // change, here or from the website, used to leave the old syllabus's lists
  // on this tab while the percentages beside them followed the new one.
  const { data: subjects, loading, error, reload } = useAsync(async () => {
    const list = await api.getSubjects(derived.subjects);
    const chapters = await Promise.all(list.map((s) => api.getChapters(s.id)));
    return list.map((s, i) => ({ s, chapters: chapters[i] }));
  }, [derived.subjects.join(), contentKey]);

  /* On a free trial, the subjects it does not open. Listed under the open one,
     not hidden: a study tab that shrank to one subject would read as the rest
     having gone missing, when they are one plan away. Names only; nothing in
     them opens. */
  const { data: locked } = useAsync(
    async () => (derived.lockedSubjects.length ? api.getSubjects(derived.lockedSubjects) : []),
    [derived.lockedSubjects.join(), contentKey],
  );

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
          : // Urdu names count as names. Matching only the English columns
            // meant a student searching in Urdu never found their own subject.
            s.name.toLowerCase().includes(needle) ||
            (s.urduName ?? '').includes(needle) ||
            chapters.some(
              (c) => c.title.toLowerCase().includes(needle) || (c.urduTitle ?? '').includes(needle),
            )
      );
    // contentKey is not read here and has to be listed: subjectPct reads the
    // chapter index, which changes underneath without React knowing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects, q, state.readSections, state.attempts, state.lastChapterId, contentKey]);

  const setup = state.onboarding;
  const eyebrow = setup
    ? t('study.setupLine', {
        class: setup.classLevel,
        board: boardName(setup.board, lang),
        medium: mediumName(setup.medium, lang),
      })
    : undefined;

  return (
    <Screen tabbed>
      <AppHeader eyebrow={eyebrow} title={t('study.title')} showStreak={false} />

      <View
        style={{
          flexDirection: rowDir(),
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
            { flex: 1, fontFamily: F.body, fontSize: 15, color: C.ink, paddingVertical: 0, textAlign: textStart() },
            isWeb && ({ outlineStyle: 'none' } as object),
          ]}
        />
      </View>

      {/* Skeleton only before the first answer: a refresh after a switch keeps
          the old list up for the moment it takes, rather than blanking it. */}
      {loading && !subjects ? (
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
                  <ScriptText text={subjectName(s, lang)} face="bodyBold" size={15} />
                  <Small>
                    {t('study.chapterCount', { n: chapters.length })} · {t('study.percentComplete', { n: pct })}
                  </Small>
                  {next ? (
                    <ScriptText
                      text={t('study.continueChapter', { chapter: chapterName(next, lang) })}
                      face="bodyBold"
                      size={12}
                      color={C.teal}
                      lines={1}
                      style={{ marginTop: 2 }}
                    />
                  ) : null}
                </View>
                <Chevron size={18} color={C.ink3} />
              </Row>
            </Card>
          ))}
        </View>
      )}

      {locked?.length && !q.trim() ? (
        <>
          <SectionTitle>{t('access.lockedSection')}</SectionTitle>
          <View style={{ gap: S.sm }}>
            {locked.map((s) => (
              <Card key={s.id} flat onPress={() => router.push(`/learn/subject/${s.id}`)} style={{ opacity: 0.75 }}>
                <Row gap={S.md}>
                  <View
                    style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.grey, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Icon name={SUBJECT_ICON[s.id] ?? 'book'} size={18} color={C.ink3} strokeWidth={2.3} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <ScriptText text={subjectName(s, lang)} face="bodyBold" size={14.5} color={C.ink2} />
                  </View>
                  <Icon name="lock" size={17} color={C.ink3} />
                </Row>
              </Card>
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
