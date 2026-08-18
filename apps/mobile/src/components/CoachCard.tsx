import { View } from 'react-native';
import { chapterById, chaptersFor, fetchLatestCoachReport, isUrduScript } from '@matricmate/core';
import { Card, Label, ScriptText, Skeleton, Small } from './ui';
import { useAsync } from '../core/useAsync';
import { useT } from '../i18n';
import { useApp } from '../store/app';
import { C, rowDir } from '../theme';
import { Markdown } from './Markdown';

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
 */
export function CoachCard() {
  const { state, derived } = useApp();
  const t = useT();

  const { data, loading } = useAsync(() => fetchLatestCoachReport(), [state.user?.id ?? '']);

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
  if (loading) {
    return (
      <Card flat tint={C.tealTint} border={C.teal} style={{ gap: 8 }}>
        <Label style={{ color: C.teal }}>{t('tutor.coachTitle')}</Label>
        <Skeleton h={13} />
        <Skeleton h={13} w="88%" />
        <Skeleton h={13} w="94%" style={{ marginBottom: 4 }} />
        <Skeleton h={11} w="40%" />
        <Skeleton h={12} w="80%" />
        <Skeleton h={12} w="72%" />
      </Card>
    );
  }


  if (!data) {
    const firstName = (state.user?.name ?? '').split(' ')[0];
    const chapter = state.lastChapterId ? chapterById(state.lastChapterId) : undefined;
    const first = chapter ?? chaptersFor(derived.subjects[0] ?? 'phy')[0];
    return (
      <Card flat tint={C.tealTint} border={C.teal} style={{ gap: 8 }}>
        <Label style={{ color: C.teal }}>{t('tutor.coachTitle')}</Label>
        <ScriptText text={t('tutor.coachWelcome', { name: firstName })} size={13.5} />
        <Label style={{ color: C.ink2, marginTop: 2 }}>{t('tutor.coachFirstSteps')}</Label>
        <View style={{ gap: 4 }}>
          {[t('tutor.coachStep1', { chapter: first?.title ?? '' }), t('tutor.coachStep2'), t('tutor.coachStep3')].map(
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
    </Card>
  );
}
