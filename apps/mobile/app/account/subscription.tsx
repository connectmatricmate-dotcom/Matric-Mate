import { AI_QUOTA, formatDate, subjectById, subjectName } from '@matricmate/core';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Icon, IconName } from '../../src/components/Icon';
import { LockedNotice } from '../../src/components/LockedNotice';
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

/** Basic's list, and the AI that Premium adds to it (see accessFor in core). */
const BASIC_PERKS: [IconName, StringKey][] = [
  ['book', 'plans.basicPerk1'],
  ['target', 'plans.basicPerk2'],
  ['chart', 'plans.basicPerk3'],
  ['download', 'plans.basicPerk4'],
];
const PREMIUM_EXTRAS: [IconName, StringKey][] = [
  ['spark', 'plans.premiumPerk2'],
  ['check', 'plans.premiumPerk3'],
  ['quill', 'plans.premiumPerk4'],
];

/** The plan's name for the status line; the stored id can still be a retired length on an old row. */
const PLAN_KEY: Record<string, StringKey> = { basic: 'billing.planBasic', trial: 'billing.planTrial', quarter: 'billing.planQuarter', year: 'billing.planYear' };

/**
 * Read-only. The app may show what a student's plan includes, but never sell,
 * price, or link to a purchase, see core/billing.ts.
 */
export default function Subscription() {
  const { state, derived } = useApp();
  const { refresh, checking } = useAuth();
  const toast = useToast();
  const t = useT();
  const { lang } = useLang();
  const active = state.premium.active;
  const tier = derived.access.tier;
  const planLabel = active ? t(PLAN_KEY[state.premium.plan ?? ''] ?? 'billing.planMonthly') : '';
  const trialSubject = tier === 'trial' ? subjectName(subjectById(derived.access.trialSubject ?? ''), lang) || derived.access.trialSubject || '' : '';

  return (
    <Screen>
      <Header title={t('account.subscriptionTitle')} back />

      <Card border={active ? C.orange : undefined}>
        <Row gap={S.md}>
          <Text style={{ fontSize: 24 }}>{active ? '👑' : '🔓'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.ink }}>
              {active ? [t('billing.statusActive'), planLabel, trialSubject].filter(Boolean).join(' · ') : t('billing.statusFree')}
            </Text>
            <Small>
              {active && state.premium.validTill
                ? t('billing.activeTill', {
                    date: formatDate(state.premium.validTill, lang, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    }),
                  })
                : t('billing.freeBody')}
            </Small>
          </View>
          <Pill tone={active ? 'green' : 'grey'}>{active ? t('account.active') : t('account.inactive')}</Pill>
        </Row>
      </Card>

      {tier === 'basic' ? (
        <>
          <SectionTitle>{t('plans.basicIncludes')}</SectionTitle>
          <Card flat>
            <View style={{ gap: S.md }}>
              {BASIC_PERKS.map(([icon, key]) => (
                <Row key={key} gap={S.md}>
                  <Icon name={icon} size={18} color={C.teal} />
                  <Text style={{ flex: 1, fontFamily: F.body, fontSize: 14, lineHeight: 21, color: C.ink }}>{t(key)}</Text>
                  <Icon name="check" size={16} color={C.green} strokeWidth={2.6} />
                </Row>
              ))}
            </View>
          </Card>
          <SectionTitle>{t('plans.notInBasic')}</SectionTitle>
          <Card flat>
            <View style={{ gap: S.md }}>
              {PREMIUM_EXTRAS.map(([icon, key]) => (
                <Row key={key} gap={S.md}>
                  <Icon name={icon} size={18} color={C.ink3} />
                  <Text style={{ flex: 1, fontFamily: F.body, fontSize: 14, lineHeight: 21, color: C.ink2 }}>{t(key, { n: AI_QUOTA.premium })}</Text>
                  <Icon name="lock" size={15} color={C.ink3} />
                </Row>
              ))}
            </View>
          </Card>
        </>
      ) : (
        <>
          <SectionTitle>{t('billing.whatsIncluded')}</SectionTitle>
          <Card flat>
            <View style={{ gap: S.md }}>
              {PERKS.map(([icon, key]) => {
                // Premium's list: ticked on Premium, a preview on anything else.
                const on = tier === 'premium';
                return (
                  <Row key={key} gap={S.md}>
                    <Icon name={icon} size={18} color={on ? C.teal : C.ink3} />
                    <Text style={{ flex: 1, fontFamily: F.body, fontSize: 14, lineHeight: 21, color: on ? C.ink : C.ink2 }}>{t(key)}</Text>
                    {on ? <Icon name="check" size={16} color={C.green} strokeWidth={2.6} /> : null}
                  </Row>
                );
              })}
            </View>
          </Card>
        </>
      )}

      {/* Basic or a trial: the plans screen says what else there is (no prices here). */}
      {tier === 'basic' || tier === 'trial' ? (
        <>
          <Spacer h={S.md} />
          <Btn title={t('trial.seePlans')} variant="orange" icon="crown" onPress={() => router.push('/upgrade')} />
        </>
      ) : null}

      <Spacer h={S.md} />
      {/*
        For the student who has just paid on the website and come back wondering
        why nothing changed. Entitlement already refreshes when the app returns
        to the front, but a button they can press is worth more than a rule they
        cannot see. It re-reads the server; it cannot grant anything.
      */}
      <Btn
        title={t('billing.checkAgain')}
        variant="line"
        sm
        icon="refresh"
        loading={checking}
        onPress={async () => {
          await refresh();
          toast(t(active ? 'billing.checkedActive' : 'billing.checkedFree'));
        }}
      />

      {/* Someone with an active plan needs no upgrade guidance at all. The
          old ternary showed them the "locked chapter" notice, which told a
          paying subscriber their chapter was not in their plan. */}
      {active ? (
        // What a subscriber does need, and the website already said: there is
        // no cancel button here because there is nothing to cancel. Without
        // this line the absence reads as a missing control rather than as the
        // point, and someone goes looking for how to stop a charge that is
        // never going to happen.
        <>
          <Spacer h={S.md} />
          <Small>{t('account.noAutoCharge')}</Small>
        </>
      ) : (
        <>
          <Spacer h={S.lg} />
          <LockedNotice variant="free" />
        </>
      )}

      <Spacer h={S.md} />
      <Card flat style={{ paddingVertical: 0 }}>
        <Item title={t('account.paymentHistory')} icon="card" last onPress={() => router.push('/account/payments')} />
      </Card>
    </Screen>
  );
}
