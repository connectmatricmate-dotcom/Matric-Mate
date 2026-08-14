import Constants from 'expo-constants';
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { LanguageToggle } from '../../src/components/LanguageToggle';
import { Btn, Card, Header, Item, Row, Screen, SectionTitle, Seg, Sheet, Small, Spacer, Toggle, useToast } from '../../src/components/ui';
import { GRADE_10_READY, Medium } from '@matricmate/core';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { S } from '../../src/theme';

export default function Settings() {
  const { state, actions } = useApp();
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClass, setConfirmClass] = useState<9 | 10 | null>(null);
  const [switching, setSwitching] = useState(false);
  const classLevel = state.onboarding?.classLevel ?? 9;
  const t = useT();
  const toast = useToast();
  const s = state.settings;
  const sizeLabel = [t('reader.small'), t('reader.medium'), t('reader.large')][s.fontScale];

  return (
    <Screen>
      <Header title={t('account.settingsTitle')} back />

      {/* App language, the interface, not the syllabus */}
      <SectionTitle>{t('lang.label')}</SectionTitle>
      <Card flat style={{ alignItems: 'center', gap: S.sm }}>
        <LanguageToggle />
        <Small style={{ textAlign: 'center' }}>
          {s.language === 'en' ? t('lang.englishHint') : t('lang.urduHint')}
        </Small>
      </Card>

      <SectionTitle>{t('account.appearance')}</SectionTitle>
      <Card flat style={{ paddingVertical: 0 }}>
        <Item
          title={t('account.darkMode')}
          sub={t('account.darkModeSub')}
          icon="moon"
          last
          right={
            // Never latches on: no dark theme exists yet, and a switch that
            // visibly turns on and does nothing trains people to distrust
            // every other switch on the page.
            <Toggle on={false} onPress={() => toast(t('account.darkToast'))} />
          }
        />
      </Card>

      {/* Medium, which version of the syllabus, separate from app language */}
      <SectionTitle>{t('account.content')}</SectionTitle>
      <Card flat style={{ paddingVertical: 0 }}>
        <Item
          title={t('tutor.classRow')}
          sub={t('tutor.classRowValue', { n: classLevel })}
          icon="award"
          onPress={() => {
            const next = classLevel === 9 ? 10 : 9;
            if (next === 10 && !GRADE_10_READY) {
              toast(t('onboarding.class10Toast'));
              return;
            }
            setConfirmClass(next);
          }}
        />
        <Item
          title={t('account.contentMedium')}
          sub={t('account.contentMediumSub')}
          icon="book2"
          right={
            <View style={{ width: 118 }}>
              <Seg<Medium>
                value={s.contentMedium}
                onChange={(m) => actions.setSettings({ contentMedium: m })}
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'ur', label: 'Urdu' },
                ]}
              />
            </View>
          }
        />
        <Item
          title={t('account.readingSize')}
          sub={sizeLabel}
          icon="book"
          last
          onPress={() => actions.setSettings({ fontScale: ((s.fontScale + 1) % 3) as 0 | 1 | 2 })}
        />
      </Card>

      <SectionTitle>{t('account.notificationsSection')}</SectionTitle>
      <Card flat style={{ paddingVertical: 0 }}>
        <Item
          title={t('account.studyReminder')}
          sub={t('account.studyReminderSub', { time: s.reminderTime })}
          icon="bell"
          right={<Toggle on={false} onPress={() => toast(t('onboarding.comingSoon'))} />}
        />
        <Item
          title={t('account.streakAlerts')}
          sub={t('account.streakAlertsSub')}
          icon="flame"
          tone="orange"
          last
          right={<Toggle on={false} onPress={() => toast(t('onboarding.comingSoon'))} />}
        />
      </Card>

      {/* Plan and invoices, reachable from settings. The gear in the header
          lands people here, and a student on the free plan still needs a way
          to find what a plan is and what they have paid before. */}
      <SectionTitle>{t('billing.premium')}</SectionTitle>
      <Card flat style={{ paddingVertical: 0 }}>
        <Item
          title={t('account.subscriptionTitle')}
          sub={state.premium.active ? t('billing.statusActive') : t('billing.statusFree')}
          icon="crown"
          onPress={() => router.push('/account/subscription')}
        />
        <Item
          title={t('account.paymentHistory')}
          icon="card"
          last
          onPress={() => router.push('/account/payments')}
        />
      </Card>

      <SectionTitle>{t('account.storage')}</SectionTitle>
      <Card flat style={{ paddingVertical: 0 }}>
        <Item
          title={t('account.manageDownloads')}
          sub={t('account.chaptersCount', { n: state.downloads.length })}
          icon="download"
          onPress={() => router.push('/learn/downloads')}
        />
        <Item
          title={t('account.resetDemo')}
          sub={t('account.resetDemoSub')}
          icon="trash"
          tone="red"
          last
          onPress={() => setConfirmReset(true)}
        />
      </Card>

      {/* One tap used to do it, no questions asked: local state, downloaded
          files AND server history, gone. That is the most destructive action
          in the app and the only one that had no confirm. */}
      <Sheet visible={confirmReset} onClose={() => setConfirmReset(false)} title={t('account.resetDemo')}>
        <Small>{t('account.resetDemoSub')}</Small>
        <Spacer h={S.md} />
        <Row gap={S.sm}>
          <Btn title={t('common.cancel')} variant="line" sm onPress={() => setConfirmReset(false)} />
          <Btn
            title={t('account.resetDemo')}
            variant="danger"
            sm
            onPress={() => {
              setConfirmReset(false);
              actions.resetDemo();
              toast(t('account.resetDone'));
            }}
          />
        </Row>
      </Sheet>

      <SectionTitle>{t('account.about')}</SectionTitle>
      <Card flat style={{ paddingVertical: 0 }}>
        <Item title={t('account.version', { v: Constants.expoConfig?.version ?? '' })} icon="help" />
        <Item title={t('account.terms')} icon="doc" last onPress={() => toast(t('account.termsToast'))} />
      </Card>
      <Spacer h={S.md} />
      <Sheet visible={confirmClass !== null} onClose={() => setConfirmClass(null)} title={t('tutor.classWarnTitle', { n: confirmClass ?? 10 })}>
        <Small>{t('tutor.classWarnBody')}</Small>
        <Spacer h={S.md} />
        <Btn
          title={t('tutor.classWarnCta')}
          variant="danger"
          loading={switching}
          onPress={() => {
            if (confirmClass === null || switching) return;
            setSwitching(true);
            void actions.switchClass(confirmClass).then((r) => {
              setSwitching(false);
              setConfirmClass(null);
              if (r === 'ok') {
                toast(t('tutor.classChanged', { n: confirmClass }));
                router.replace('/(tabs)');
              } else {
                toast(r === 'cooldown' ? t('tutor.classCooldown') : t('states.errorTitle'));
              }
            });
          }}
        />
        <Spacer h={S.sm} />
        <Btn title={t('common.cancel')} variant="line" onPress={() => setConfirmClass(null)} />
      </Sheet>
    </Screen>
  );
}
