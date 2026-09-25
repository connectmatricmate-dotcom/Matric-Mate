import { useEffect, useRef } from 'react';
import { AI_QUOTA, formatDate, hasEnded, subjectById, subjectName } from '@matricmate/core';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Icon, IconName } from '../../src/components/Icon';
import { planNameKey } from '../../src/components/planName';
import { Btn, Card, Header, Item, Pill, Row, Screen, SectionTitle, Small, Spacer, Text, useToast } from '../../src/components/ui';
import { useLang, useT } from '../../src/i18n';
import type { StringKey } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { useAuth } from '../../src/store/auth';
import { C, F, S } from '../../src/theme';

const PERKS: [IconName, StringKey][] = [
  ['book', 'billing.perk1'],
  ['target', 'billing.perk2'],
  ['spark', 'billing.perk3'],
  ['chart', 'billing.perk4'],
  ['download', 'billing.perk5'],
];

/** Basic's own list: what the plan the student holds opens (see accessFor in core). */
const BASIC_PERKS: [IconName, StringKey][] = [
  ['book', 'plans.basicPerk1'],
  ['target', 'plans.basicPerk2'],
  ['chart', 'plans.basicPerk3'],
  ['download', 'plans.basicPerk4'],
];

/**
 * The student's own plan: what it is, until when, and what it opens, and where
 * plans are chosen and renewed, named in plain words. No prices, no other
 * plans and no link to the website, which Google Play would read as leading
 * the student to pay outside Play (core/billing.ts).
 */
export default function Subscription() {
  const { state, derived } = useApp();
  const { refresh, checking } = useAuth();
  const toast = useToast();
  const t = useT();
  const { lang } = useLang();
  const active = state.premium.active;
  const tier = derived.access.tier;
  // The same name the Settings row gives it; see planNameKey.
  const planLabel = active ? t(planNameKey(state.premium.plan)) : '';
  const trialSubject = tier === 'trial' ? subjectName(subjectById(derived.access.trialSubject ?? ''), lang) || derived.access.trialSubject || '' : '';
  // "Ended on" only for a date that has passed: a plan switched off early keeps a date still to come.
  const shown = state.premium.validTill && (active || hasEnded(state.premium.validTill)) ? state.premium.validTill : null;
  const date = shown ? formatDate(shown, lang, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const email = state.user?.contact ?? '';
  // After "Check again" the answer is whatever the re-read found, not what
  // this render held before it: the toast used to report the old state.
  const activeNow = useRef(active);
  useEffect(() => {
    activeNow.current = active;
  }, [active]);

  return (
    <Screen>
      <Header title={t('account.subscriptionTitle')} back />

      <Card border={active ? C.orange : undefined}>
        <Row gap={S.md}>
          <Text style={{ fontSize: 24 }}>{active ? '👑' : '🔓'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.ink }}>
              {active ? [t('billing.statusActive'), planLabel, trialSubject].filter(Boolean).join(' · ') : t('access.noPlan')}
            </Text>
            <Small>{date ? t(active ? 'access.activeUntil' : 'access.endedOn', { date }) : t('paused.noneBody')}</Small>
          </View>
          <Pill tone={active ? 'green' : 'grey'}>{active ? t('account.active') : t('account.inactive')}</Pill>
        </Row>
      </Card>

      {active && tier === 'premium' ? (
        <>
          <SectionTitle>{t('billing.whatsIncluded')}</SectionTitle>
          <PerkList perks={PERKS} />
        </>
      ) : active && tier === 'basic' ? (
        <>
          <SectionTitle>{t('plans.basicIncludes')}</SectionTitle>
          <PerkList perks={BASIC_PERKS} />
        </>
      ) : null}

      <Card flat tint={C.tealTint} style={{ marginTop: S.md }}>
        <Small style={{ color: C.ink2 }}>{email ? t('plansWhere.subscription', { email }) : t('plansWhere.subscriptionNoEmail')}</Small>
      </Card>
      <Spacer h={S.md} />
      {/*
        For the student whose plan has just been switched on and who came back
        wondering why nothing changed. The plan is also re-read whenever the app
        returns to the front, but a button they can press is worth more than a
        rule they cannot see. It re-reads the server; it cannot grant anything.
      */}
      <Btn
        title={t('billing.checkAgain')}
        variant="line"
        sm
        icon="refresh"
        loading={checking}
        onPress={async () => {
          await refresh();
          // A render has happened by now; the ref holds what the re-read found.
          setTimeout(() => toast(t(activeNow.current ? 'billing.checkedActive' : 'billing.checkedFree')), 0);
        }}
      />

      <Spacer h={S.md} />
      <Card flat style={{ paddingVertical: 0 }}>
        <Item title={t('account.paymentHistory')} icon="card" last onPress={() => router.push('/account/payments')} />
      </Card>
    </Screen>
  );
}

function PerkList({ perks }: { perks: [IconName, StringKey][] }) {
  const t = useT();
  return (
    <Card flat>
      <View style={{ gap: S.md }}>
        {perks.map(([icon, key]) => (
          <Row key={key} gap={S.md}>
            <Icon name={icon} size={18} color={C.teal} />
            <Text style={{ flex: 1, fontFamily: F.body, fontSize: 14, lineHeight: 21, color: C.ink }}>{t(key, { n: AI_QUOTA.premium })}</Text>
            <Icon name="check" size={16} color={C.green} strokeWidth={2.6} />
          </Row>
        ))}
      </View>
    </Card>
  );
}
