import { View } from 'react-native';
import { router } from 'expo-router';
import { LanguageToggle } from '../../src/components/LanguageToggle';
import { Card, Header, Item, Screen, SectionTitle, Seg, Small, Spacer, Toggle, useToast } from '../../src/components/ui';
import { Medium } from '@matricmate/core';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { S } from '../../src/theme';

export default function Settings() {
  const { state, actions } = useApp();
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
            <Toggle
              on={s.dark}
              onPress={() => {
                actions.setSettings({ dark: !s.dark });
                toast(t('account.darkToast'));
              }}
            />
          }
        />
      </Card>

      {/* Medium, which version of the syllabus, separate from app language */}
      <SectionTitle>{t('account.content')}</SectionTitle>
      <Card flat style={{ paddingVertical: 0 }}>
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
          right={<Toggle on={s.reminders} onPress={() => actions.setSettings({ reminders: !s.reminders })} />}
        />
        <Item
          title={t('account.streakAlerts')}
          sub={t('account.streakAlertsSub')}
          icon="flame"
          tone="orange"
          last
          right={<Toggle on={s.streakAlerts} onPress={() => actions.setSettings({ streakAlerts: !s.streakAlerts })} />}
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
          onPress={() => {
            actions.resetDemo();
            toast(t('account.resetDone'));
          }}
        />
      </Card>

      <SectionTitle>{t('account.about')}</SectionTitle>
      <Card flat style={{ paddingVertical: 0 }}>
        <Item title={t('account.version', { v: '0.2.0' })} icon="help" />
        <Item title={t('account.terms')} icon="doc" last onPress={() => toast(t('account.termsToast'))} />
      </Card>
      <Spacer h={S.md} />
    </Screen>
  );
}
