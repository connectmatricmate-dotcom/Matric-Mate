import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { AI_QUOTA, subjectById, subjectName } from '@matricmate/core';
import { Chevron, Confirm, Card, Header, IconButton, Item, Screen, Skeleton, Small, useToast } from '../src/components/ui';
import { useAsync } from '../src/core/useAsync';
import { useLang, useT } from '../src/i18n';
import { supabase } from '../src/lib/supabase';
import { useApp } from '../src/store/app';
import { useAuth } from '../src/store/auth';
import { C, S } from '../src/theme';

/**
 * The first screen after onboarding for a new account: the free trial starts
 * here, by picking its one subject.
 *
 * There used to be a choice between the trial and the plans, on a screen that
 * also compared the plans and handed over a link to buy one. A new student now
 * simply starts: three days, one subject, and the three days count from this
 * tap. Nothing on it is a purchase (core/billing.ts).
 *
 * Only subjects with chapters for the student's own class and board are
 * offered. The database refuses the rest, and a student who picked one used
 * to meet "The trial could not start. Try again", which no retry could fix.
 */
export default function StartTrial() {
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const { state } = useApp();
  const { refresh, entitlementReady } = useAuth();
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const board = state.onboarding?.board ?? 'fbise';
  const grade = state.onboarding?.classLevel ?? 9;
  const mine = state.onboarding?.subjects ?? [];

  // Out of here the moment there is a plan (this tap, or one given by hand),
  // or once the trial is no longer on offer.
  useEffect(() => {
    if (state.premium.active) router.replace('/(tabs)');
    else if (entitlementReady && state.premium.trialState && state.premium.trialState !== 'eligible') router.replace('/paused');
  }, [state.premium.active, state.premium.trialState, entitlementReady]);

  /** How many published chapters each subject has on this student's syllabus. */
  const { data: counts, loading } = useAsync(async () => {
    const { data, error } = await supabase
      .from('chapters')
      .select('subject_id')
      .eq('board', board)
      .eq('grade', grade)
      .eq('review_status', 'published');
    if (error || !data) return null;
    const n = new Map<string, number>();
    for (const r of data as { subject_id: string }[]) n.set(r.subject_id, (n.get(r.subject_id) ?? 0) + 1);
    return n;
  }, [board, grade]);

  // The student's own subjects, in their order, that have something to open.
  // If the count could not be read, all of them: the database still refuses
  // an empty one, and that refusal now says what to do.
  const offered = mine.filter((id) => (counts ? (counts.get(id) ?? 0) > 0 : true));

  async function start() {
    if (!pick || busy) return;
    setBusy(true);
    const { error } = await supabase.rpc('start_trial', { p_subject: pick });
    if (error) {
      setBusy(false);
      setPick(null);
      const m = error.message;
      if (/finish onboarding/.test(m)) {
        toast(t('trialStart.errorOnboarding'));
        router.replace('/onboarding/class');
        return;
      }
      toast(
        /already used/.test(m)
          ? t('trial.errorUsed')
          : /already on a plan/.test(m)
            ? t('trial.errorPlan')
            : /had a plan|paid before/.test(m)
              ? t('trial.errorPaid')
              : /no chapters/.test(m)
                ? t('trialStart.errorNoChapters')
                : t('trial.errorGeneric'),
      );
      return;
    }
    // The plan arrives through the same read as any other; the effect above
    // then moves on to the dashboard, where the welcome card is waiting.
    await refresh();
    setBusy(false);
  }

  const pickedName = pick ? subjectName(subjectById(pick), lang) || pick : '';

  return (
    <Screen>
      <Header
        title={t('trialStart.title')}
        sub={t('trialStart.sub', { n: AI_QUOTA.trial })}
        right={<IconButton icon="gear" tone="card" onPress={() => router.push('/account')} />}
      />
      <Small style={{ marginTop: S.sm, marginBottom: S.sm, color: C.teal }}>{t('trialStart.pick')}</Small>
      {loading && !counts ? (
        // Shaped like the list it stands in for, so nothing jumps when it lands.
        <Card flat style={{ gap: S.lg, paddingVertical: S.lg }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} w="60%" h={16} />
          ))}
        </Card>
      ) : offered.length === 0 ? (
        <Card flat tint={C.orangeTint}>
          <Small>{t('trialStart.none')}</Small>
        </Card>
      ) : (
        <Card flat style={{ paddingVertical: 0 }}>
          {offered.map((id, i) => {
            const s = subjectById(id);
            const n = counts?.get(id);
            return (
              <Item
                key={id}
                title={subjectName(s, lang) || id}
                sub={n ? t('study.chapterCount', { n }) : undefined}
                icon={s?.icon}
                tone="teal"
                last={i === offered.length - 1}
                onPress={() => setPick(id)}
                right={<Chevron />}
              />
            );
          })}
        </Card>
      )}

      <Confirm
        visible={!!pick}
        onClose={() => (busy ? undefined : setPick(null))}
        title={t('trialStart.confirmTitle', { subject: pickedName })}
        body={t('trialStart.confirmBody')}
        confirmLabel={t('trialStart.confirmCta', { subject: pickedName })}
        cancelLabel={t('common.cancel')}
        tone="primary"
        loading={busy}
        onConfirm={() => void start()}
      />
    </Screen>
  );
}
