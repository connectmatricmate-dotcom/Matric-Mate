'use client';

import { useState } from 'react';
import type { Language, Medium } from '@matricmate/core';
import { APP_VERSION } from '@/lib/site';
import { CardGrid, Page, PageHead } from '@/components/app/Page';
import { Btn, ItemButton, Seg, Toggle } from '@/components/ui/controls';
import { Card, Item, Label, Pill } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { useApp, useT } from '@/lib/store';

/** A titled group of rows. Two per row on desktop, so a toggle never floats away from its label. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2">
        <Label>{title}</Label>
      </div>
      <Card flat className="py-0">
        {children}
      </Card>
    </section>
  );
}

export function SettingsView() {
  const { state, actions } = useApp();
  const t = useT();
  const toast = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  const s = state.settings;
  const sizeLabel = [t('reader.small'), t('reader.medium'), t('reader.large')][s.fontScale];

  return (
    <Page width="focus">
      <PageHead back="/account" backLabel={t('account.title')} title={t('account.settingsTitle')} />

      {/* App language sits alone at the top: it changes every other word on this page. */}
      <Card className="mb-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
        <div className="min-w-0">
          <p className="text-[14.5px] font-extrabold text-ink">{t('lang.label')}</p>
          <p className="text-[13px] text-ink2">{s.language === 'en' ? t('lang.englishHint') : t('lang.urduHint')}</p>
        </div>
        <Seg
          value={s.language}
          onChange={(l: Language) => actions.setSettings({ language: l })}
          label={t('lang.label')}
          options={[
            { value: 'en' as Language, label: t('lang.english') },
            { value: 'ur' as Language, label: t('lang.urdu') },
          ]}
        />
      </Card>

      <CardGrid>
        <Group title={t('account.content')}>
          <Item
            title={t('account.contentMedium')}
            sub={t('account.contentMediumSub')}
            icon="layers"
            right={
              <Seg
                value={s.contentMedium}
                onChange={(m: Medium) => actions.setSettings({ contentMedium: m })}
                label={t('account.contentMedium')}
                options={[
                  { value: 'en' as Medium, label: 'Eng' },
                  { value: 'ur' as Medium, label: 'Urdu' },
                ]}
              />
            }
          />
          <ItemButton
            title={t('account.readingSize')}
            sub={sizeLabel}
            icon="book"
            last
            onClick={() => actions.setSettings({ fontScale: ((s.fontScale + 1) % 3) as 0 | 1 | 2 })}
          />
        </Group>

        <Group title={t('account.notificationsSection')}>
          <Item
            title={t('account.studyReminder')}
            sub={t('account.studyReminderSub', { time: s.reminderTime })}
            icon="bell"
            right={
              <Toggle
                on={s.reminders}
                label={t('account.studyReminder')}
                onClick={() => actions.setSettings({ reminders: !s.reminders })}
              />
            }
          />
          <Item
            title={t('account.streakAlerts')}
            sub={t('account.streakAlertsSub')}
            icon="flame"
            tone="orange"
            last
            right={
              <Toggle
                on={s.streakAlerts}
                label={t('account.streakAlerts')}
                onClick={() => actions.setSettings({ streakAlerts: !s.streakAlerts })}
              />
            }
          />
        </Group>

        <Group title={t('account.appearance')}>
          {/* No toggle until dark mode exists. A switch that visibly flips and
              changes nothing is the fastest way to lose a user's trust. */}
          <Item
            title={t('account.darkMode')}
            sub={t('account.darkModeSub')}
            icon="moon"
            last
            right={<Pill tone="grey">{t('onboarding.comingSoon')}</Pill>}
          />
        </Group>

        <Group title={t('billing.premium')}>
          <Item
            href="/account/subscription"
            title={t('account.subscriptionTitle')}
            sub={state.premium.active ? t('billing.statusActive') : t('billing.statusFree')}
            icon="crown"
          />
          <Item href="/account/payments" title={t('account.paymentHistory')} icon="card" last />
        </Group>

        <Group title={t('account.storage')}>
          <ItemButton
            title={t('account.resetDemo')}
            sub={t('account.resetDemoSub')}
            icon="trash"
            tone="red"
            last
            onClick={() => setConfirmReset(true)}
          />
        </Group>

        <Group title={t('account.about')}>
          <Item title={t('account.version', { v: APP_VERSION })} icon="help" />
          <Item href="/terms" title={t('account.terms')} icon="doc" last />
        </Group>
      </CardGrid>

      <Sheet open={confirmReset} onClose={() => setConfirmReset(false)} title={t('account.resetDemo')}>
        <p className="text-[13.5px] leading-[1.6] text-ink2">{t('account.resetDemoSub')}</p>
        <Btn
          title={t('account.resetDemo')}
          variant="danger"
          className="mt-5 w-full"
          onClick={() => {
            actions.resetDemo();
            setConfirmReset(false);
            toast(t('account.resetDone'));
          }}
        />
        <Btn title={t('common.cancel')} variant="ghost" className="mt-2 w-full" onClick={() => setConfirmReset(false)} />
      </Sheet>
    </Page>
  );
}
