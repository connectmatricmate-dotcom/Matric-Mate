import { View } from 'react-native';
import { router } from 'expo-router';
import { chapterById, chapterName, fetchLatestCoachReport, isUrduScript, nextAction, nextStep, planChapterId } from '@matricmate/core';
import { Btn, Card, Label, ScriptText, Skeleton, Small } from './ui';
import { useAsync } from '../core/useAsync';
import { useLang, useT } from '../i18n';
import { useApp } from '../store/app';
import { C, rowDir } from '../theme';
import { Markdown } from './Markdown';
import { ReportAi } from './ReportAi';

/**
 * The AI coach on the dashboard: two sentences about the week, the two weakest
 * topics with why they matter, three things to do next.
 *
 * This only reads. Reports are written by the nightly job in
 * /api/cron/coach, so opening the dashboard never waits on a model call and
 * the text keeps up with a student who studies daily rather than being fixed
 * from Monday to Sunday.
 *
 * And it is never blank. It used to return null for a student with no history,
 * so the newest students, the ones with the least idea what to do, got the
 * least guidance. They now get a welcome and three concrete first steps,
 * written locally: there is nothing to report on yet, and a coach inventing a
 * week they have not had would be worse than saying so plainly.
 *
 * It ends in a button. Describing the week and stopping leaves the student to
 * work out what to do about it, which is the decision the card was supposed to
 * take off them. One button, never a row of them: three choices is the same
 * decision again, only with more steps.
 */
export function CoachCard() {
  const { state, derived, contentLoading } = useApp();
  const t = useT();
  const { lang } = useLang();
  const grade = state.onboarding?.classLevel ?? 9;
  const board = state.onboarding?.board ?? 'fbise';

  /* Read again when the class, board or language changes, not only per
     account: a report written for last month's syllabus, or in the other
     language, used to sit under "This week" until the app was restarted. */
  /* And again when a new report lands. Every report arrives with a "report
     ready" notice in the inbox, which reaches the app live; the card only read
     on its first render, so a student who opened the app on that notice saw
     yesterday's card, or the welcome, until they restarted it. */
  const reportNotice = state.notifications.find((n) => n.kind === 'report')?.id ?? '';
  // Basic has no AI coach: the server writes no report for it and refuses the read.
  const ai = derived.access.ai;
  const { data, loading } = useAsync(
    () => (ai ? fetchLatestCoachReport() : Promise.resolve(null)),
    [state.user?.id ?? '', grade, board, lang, reportNotice, ai],
  );

  /* The one thing to do next, chosen in core so the browser picks the same
     thing for the same student. Null when there is genuinely nothing: a
     student who has studied today and has no weak topic is allowed to be
     finished, and a button insisting otherwise would be nagging. */
  const step = nextStep(
    nextAction({
      subjectIds: derived.subjects,
      grade,
      board,
      lastChapterId: state.lastChapterId,
      lastSectionIndex: state.lastSectionIndex,
      readSections: state.readSections,
      attempts: state.attempts,
      activeDays: state.activeDays,
      plan: derived.plan,
    }),
    lang,
  );
  const cta = step ? <Btn title={step.label} variant="orange" onPress={() => router.push(step.href as never)} /> : null;

  /* Without the coach, the one thing it always ends on: what to do next. */
  if (!ai) {
    if (!cta) return null;
    return (
      <Card flat tint={C.tealTint} border={C.teal} style={{ gap: 8 }}>
        <Label style={{ color: C.teal }}>{t('study.upNext')}</Label>
        {cta}
      </Card>
    );
  }

  /**
   * A skeleton while the report is in flight, not the welcome card.
   *
   * `data` is null both while loading and when a student genuinely has no
   * report, and the card treated those the same. So every student with a
   * report saw the "welcome, here are three first steps" card for as long as
   * the fetch took, then watched it swap to their actual week. Two different
   * pieces of writing in the same box, one of them wrong, on every dashboard
   * open. Shape-matched to the real card so nothing jumps when it arrives.
   */
  // The plan and the first chapter both wait on the chapter index, so a new
  // student's welcome waits with them rather than naming nothing.
  if ((loading && !data) || (!data && contentLoading && derived.plan.length === 0)) {
    return (
      <Card flat tint={C.tealTint} border={C.teal} style={{ gap: 8 }}>
        <Label style={{ color: C.teal }}>{t('tutor.coachTitle')}</Label>
        {/* Each bar carries the colour of the line it stands in for: the
            summary is ink, the label and the actions below it are ink2. */}
        <Skeleton h={13} tone="ink" />
        <Skeleton h={13} w="88%" tone="ink" />
        <Skeleton h={13} w="94%" tone="ink" style={{ marginBottom: 4 }} />
        <Skeleton h={11} w="40%" tone="ink2" />
        <Skeleton h={12} w="80%" tone="ink2" />
        <Skeleton h={12} w="72%" tone="ink2" />
      </Card>
    );
  }


  if (!data) {
    const firstName = (state.user?.name ?? '').split(' ')[0];
    /* The same chapter the button below starts, chosen the same way. This
       named the first chapter of the first subject, Matrices for everyone,
       while the button under it started a chapter that has something in it. */
    const firstId = planChapterId(derived.subjects, grade, state.lastChapterId, state.readSections, board);
    const firstChapter = firstId ? chapterName(chapterById(firstId), lang) : '';
    const steps = [
      firstChapter ? t('tutor.coachStep1', { chapter: firstChapter }) : null,
      t('tutor.coachStep2'),
      t('tutor.coachStep3'),
    ].filter((s): s is string => !!s);
    return (
      <Card flat tint={C.tealTint} border={C.teal} style={{ gap: 8 }}>
        <Label style={{ color: C.teal }}>{t('tutor.coachTitle')}</Label>
        <ScriptText text={t('tutor.coachWelcome', { name: firstName })} size={13.5} />
        <Label style={{ color: C.ink2, marginTop: 2 }}>{t('tutor.coachFirstSteps')}</Label>
        <View style={{ gap: 4 }}>
          {steps.map(
            (step, i) => (
              <View key={i} style={{ flexDirection: rowDir(), alignItems: 'flex-start', gap: 6 }}>
                <Small>{i + 1}.</Small>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <ScriptText text={step} size={13} color={C.ink2} />
                </View>
              </View>
            ),
          )}
        </View>
        {cta}
      </Card>
    );
  }
  return (
    <Card flat tint={C.tealTint} border={C.teal} style={{ gap: 8 }}>
      <Label style={{ color: C.teal }}>{t('tutor.coachTitle')}</Label>
      <Markdown text={data.summary} size={13.5} />
      {data.weak.slice(0, 2).map((w) => (
        <View key={w.topic}>
          <ScriptText text={w.topic} face="bodyBold" size={13} />
          <ScriptText text={w.why} size={12} color={C.ink2} />
        </View>
      ))}
      <Label style={{ color: C.ink2, marginTop: 2 }}>{t('tutor.coachActions')}</Label>
      <View style={{ gap: 4 }}>
        {data.actions.slice(0, 3).map((a, i) => {
          // The list supplies the number; strip one the model wrote.
          const action = a.replace(/^\s*\d{1,2}[.)]\s*/, '');
          // An Urdu action reads right to left, so its number belongs at the
          // right-hand start of the line, not stranded on the left.
          const rtl = isUrduScript(action);
          return (
            <View key={i} style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 6 }}>
              <Small>{i + 1}.</Small>
              <View style={{ flex: 1, minWidth: 0 }}>
                <ScriptText text={action} size={13} color={C.ink2} />
              </View>
            </View>
          );
        })}
      </View>
      <ReportAi surface="coach" excerpt={data.summary} />
      {cta}
    </Card>
  );
}
