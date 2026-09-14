import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { AI_QUOTA, BILLING_SITE, formatDate, subjectById, subjectName, type StringKey } from '@matricmate/core';
import { Icon } from '../src/components/Icon';
import { PlanLink } from '../src/components/LockedNotice';
import { Btn, Card, H2, H3, Pill, Row, Screen, SectionTitle, Small, Spacer, useToast } from '../src/components/ui';
import { useAsync } from '../src/core/useAsync';
import { useLang, useT } from '../src/i18n';
import { supabase } from '../src/lib/supabase';
import { useAuth } from '../src/store/auth';
import { useApp } from '../src/store/app';
import { C, F, S } from '../src/theme';

const BASIC_PERKS: StringKey[] = ['plans.basicPerk1', 'plans.basicPerk2', 'plans.basicPerk3', 'plans.basicPerk4'];
const PREMIUM_PERKS: StringKey[] = ['plans.premiumPerk1', 'plans.premiumPerk2', 'plans.premiumPerk3', 'plans.premiumPerk4'];

/**
 * The plans screen: where a signed-in student without a plan lands, and where
 * one on Basic or on the free trial comes to see what else there is.
 *
 * It cannot sell anything, and it names no price (core/billing.ts). What it
 * can do: say what each plan opens, start the free trial, which costs nothing
 * and is not a purchase, hand over a link to the website where plans are
 * managed, and check again after paying there. That last button is why
 * students do not write in: a payment made in a browser is invisible to this
 * app until it re-reads the server.
 */
export default function Upgrade() {
  const t = useT();
  const { lang } = useLang();
  const { state, derived } = useApp();
  const { refresh, entitlement } = useAuth();
  const access = derived.access;

  /**
   * A plan arriving is the way out of here.
   *
   * Entitlement can land after this screen opens: a student pays in the
   * browser and comes back, a trial starts, or the plan simply had not loaded
   * yet. Only a change counts: a student on Basic or a trial who opened this
   * on purpose is not sent straight back.
   */
  const openedOn = useRef(access.tier);
  useEffect(() => {
    if (access.active && access.tier !== openedOn.current) router.replace('/(tabs)');
  }, [access.active, access.tier]);

  // The trial is for accounts that have never had one and never paid: the
  // database refuses anyone else, and the offer should not be shown to them.
  const { data: paidBefore } = useAsync(async () => {
    if (access.active || entitlement.trialUsed || !state.user?.id) return true;
    const { count, error } = await supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'paid');
    return error ? true : (count ?? 0) > 0;
  }, [access.active, entitlement.trialUsed, state.user?.id]);
  const trialOffer = !access.active && !entitlement.trialUsed && paidBefore === false;

  const until = access.validTill ? formatDate(access.validTill, lang, { day: 'numeric', month: 'long' }) : '';
  const trialSubject = subjectName(subjectById(access.trialSubject ?? ''), lang) || access.trialSubject || '';
  const expired = Boolean(state.premium.validTill) && !access.active;
  const head =
    access.tier === 'trial'
      ? { icon: 'clock' as const, title: t('trial.currentTitle', { subject: trialSubject }), body: t('trial.currentBody', { subject: trialSubject, date: until }) }
      : access.tier === 'basic'
        ? { icon: 'crown' as const, title: t('plans.basicCurrentTitle'), body: t('plans.basicCurrentBody', { date: until }) }
        : access.tier === 'premium'
          ? { icon: 'crown' as const, title: t('billing.planMonthly'), body: t('billing.activeTill', { date: until }) }
          : {
              icon: 'crown' as const,
              title: t('billing.statusFree'),
              // The plan that ran out says which ending this is.
              body: entitlement.plan === 'trial' ? t('trial.ended') : expired ? t('billing.expiredBody') : t('billing.freeBody'),
            };

  return (
    <Screen>
      <Spacer h={S.lg} />
      <Row gap={S.md}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 99,
            backgroundColor: C.orangeTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={head.icon} size={24} color={C.orangeDark} />
        </View>
        <View style={{ flex: 1 }}>
          <H2>{head.title}</H2>
        </View>
      </Row>
      <Spacer h={S.sm} />
      <Small style={{ color: C.ink2 }}>{head.body}</Small>

      {trialOffer ? (
        <>
          <Spacer h={S.md} />
          <TrialOffer />
        </>
      ) : null}

      <SectionTitle>{t('plans.premiumName')}</SectionTitle>
      <PlanCard ai current={access.tier === 'premium'} />
      <SectionTitle>{t('plans.basicName')}</SectionTitle>
      <PlanCard current={access.tier === 'basic'} />

      <Spacer h={S.md} />
      <Card flat tint={C.tealTint}>
        <Small style={{ color: C.ink }}>{t('plans.androidNote', { site: BILLING_SITE })}</Small>
        <PlanLink bare />
      </Card>

      <Spacer h={S.lg} />
      <Btn title={t('billing.checkAgain')} variant="line" icon="refresh" onPress={() => void refresh()} />
      <Spacer h={S.sm} />
      {access.active ? (
        <Btn title={t('common.back')} variant="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} />
      ) : (
        <Btn title={t('account.settingsTitle')} variant="ghost" onPress={() => router.push('/account')} />
      )}
      <Spacer h={S.lg} />
    </Screen>
  );
}

/** One plan, described: what it opens, and whether it is the student's now. No price, ever, on this app. */
function PlanCard({ ai, current }: { ai?: boolean; current?: boolean }) {
  const t = useT();
  return (
    <Card flat border={ai ? C.orange : undefined}>
      <Row gap={S.sm} style={{ justifyContent: 'space-between' }}>
        <H3 style={{ flexShrink: 1 }}>{t(ai ? 'plans.premiumTag' : 'plans.basicTag')}</H3>
        {current ? <Pill tone="green">{t('plans.current')}</Pill> : null}
      </Row>
      <Spacer h={S.sm} />
      {(ai ? PREMIUM_PERKS : BASIC_PERKS).map((key) => (
        <Row key={key} gap={S.sm} style={{ alignItems: 'flex-start', paddingVertical: 4 }}>
          <Icon name="check" size={17} color={C.green} strokeWidth={2.6} />
          <Small style={{ flex: 1, color: C.ink }}>{t(key, { n: AI_QUOTA.premium })}</Small>
        </Row>
      ))}
    </Card>
  );
}

/**
 * Three days, one subject, once. Started in the database (start_trial), which
 * refuses anything this should not have been shown for; the plan then arrives
 * through the same re-read as a payment, and the screen moves on by itself.
 */
function TrialOffer() {
  const t = useT();
  const { lang } = useLang();
  const { derived } = useApp();
  const { refresh } = useAuth();
  const toast = useToast();
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    if (!pick || busy) return;
    setBusy(true);
    const { error } = await supabase.rpc('start_trial', { p_subject: pick });
    if (error) {
      setBusy(false);
      const m = error.message;
      toast(
        /already used/.test(m) ? t('trial.errorUsed') : /already on a plan/.test(m) ? t('trial.errorPlan') : /paid before/.test(m) ? t('trial.errorPaid') : t('trial.errorGeneric'),
      );
      return;
    }
    await refresh();
    setBusy(false);
  }

  return (
    <Card flat tint={C.tealTint} border={C.teal}>
      <H3>{t('trial.offerTitle')}</H3>
      <Spacer h={4} />
      <Small style={{ color: C.ink2 }}>{t('trial.offerBody', { n: AI_QUOTA.trial })}</Small>
      <Spacer h={S.md} />
      <Small style={{ fontFamily: F.bodyBold, color: C.teal }}>{t('trial.pickSubject')}</Small>
      <Spacer h={S.sm} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
        {derived.subjects.map((sid) => (
          <Pill key={sid} tone={sid === pick ? 'teal' : 'grey'} onPress={() => setPick(sid)} style={{ paddingVertical: 9, paddingHorizontal: 14 }}>
            {subjectName(subjectById(sid), lang) || sid}
          </Pill>
        ))}
      </View>
      <Spacer h={S.md} />
      <Btn title={t('trial.start')} disabled={!pick} loading={busy} onPress={() => void start()} />
    </Card>
  );
}
