import { Text, View } from 'react-native';
import { buildCoachDigest, fetchCoachReport } from '@matricmate/core';
import { Card, Label, Small } from './ui';
import { useAsync } from '../core/useAsync';
import { useT } from '../i18n';
import { useApp } from '../store/app';
import { C, F } from '../theme';
import { Markdown } from './Markdown';

/**
 * The weekly AI coach on the dashboard: two sentences about the week, the
 * two weakest topics with why they matter, three things to do next. The
 * server caches one report per week, so this costs one model call every
 * Monday, not one per open. Renders nothing until a report exists, and
 * nothing at all offline: a coach who cannot see the week stays quiet.
 */
export function CoachCard() {
  const { state, derived } = useApp();
  const t = useT();

  const { data } = useAsync(async () => {
    // No practice yet means nothing to coach; skip the call entirely.
    if (!state.attempts.length) return null;
    const res = await fetchCoachReport(
      buildCoachDigest({
        attempts: state.attempts,
        streak: derived.streak,
        xp: state.xp,
        subjects: derived.subjects,
        language: state.settings.language,
      }),
    );
    return res.ok ? res.report : null;
  }, [state.attempts.length > 0 ? 'y' : 'n']);

  if (!data) return null;
  return (
    <Card flat tint={C.tealTint} border={C.teal} style={{ gap: 8 }}>
      <Label style={{ color: C.teal }}>{t('tutor.coachTitle')}</Label>
      <Markdown text={data.summary} size={13.5} />
      {data.weak.slice(0, 2).map((w) => (
        <View key={w.topic}>
          <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: C.ink }}>{w.topic}</Text>
          <Small style={{ fontSize: 12 }}>{w.why}</Small>
        </View>
      ))}
      <Label style={{ color: C.ink2, marginTop: 2 }}>{t('tutor.coachActions')}</Label>
      <View style={{ gap: 4 }}>
        {data.actions.slice(0, 3).map((a, i) => (
          <Small key={i}>
            {/* The list supplies the number; strip one the model wrote. */}
            {i + 1}. {a.replace(/^\s*\d{1,2}[.)]\s*/, '')}
          </Small>
        ))}
      </View>
    </Card>
  );
}
