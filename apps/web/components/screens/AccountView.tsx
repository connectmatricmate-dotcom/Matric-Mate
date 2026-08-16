'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Language } from '@matricmate/core';
import { GRADE_10_READY, levelProgress, xpToNextLevel } from '@matricmate/core';
import { signOutAction } from '@/app/(auth)/actions';
import { planById } from '@/lib/plans';
import { APP_VERSION } from '@/lib/site';
import { CardGrid, Page, PageHead, Rail, Split, Work } from '@/components/app/Page';
import { CoverageRail, StreakRail } from '@/components/app/rails';
import { AvatarBadge } from '@/components/ui/AvatarBadge';
import { Btn, ItemButton, Seg, Toggle } from '@/components/ui/controls';
import { useToast } from '@/components/ui/toast';
import { Bar, Card, Icon, Item, Label, LinkBtn, Pill } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { useApp, useT } from '@/lib/store';

/** A titled group of rows, so a toggle never floats away from its label. */
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

/**
 * The ONE settings surface. There used to be two: the avatar card opened
 * "Account" and the sidebar gear opened "Settings", and nobody could
 * predict which of their things lived where (the client's own words).
 * Everything lives here now, ordered by how often a student touches it;
 * /account/settings redirects here so old links hold.
 */
export function AccountView() {
  const { state, actions, derived } = useApp();
  const t = useT();
  const [confirmOut, setConfirmOut] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClass, setConfirmClass] = useState<9 | 10 | null>(null);
  const [switching, setSwitching] = useState(false);
  const toast = useToast();
  const classLevel = state.onboarding?.classLevel ?? 9;
  const [signingOut, setSigningOut] = useState(false);
  const setup = state.onboarding;
  const s = state.settings;
  const sizeLabel = [t('reader.small'), t('reader.medium'), t('reader.large')][s.fontScale];

  return (
    <Page>
      <PageHead
        back="/dashboard"
        backLabel={t('tabs.home')}
        title={t('account.settingsTitle')}
        actions={<LinkBtn title={t('account.editTitle')} href="/account/edit" variant="line" sm icon="edit" />}
      />

      <Split>
        <Work className="flex flex-col gap-4">
          {/* Who am I */}
          <Card className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <AvatarBadge index={s.avatar ?? 0} size={64} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-[20px] text-ink">{state.user?.name ?? 'Student'}</p>
              <p className="text-[13.5px] text-ink2">
                {t('account.classLine', {
                  class: setup?.classLevel ?? 9,
                  board: setup?.board === 'punjab' ? 'Punjab Board' : 'FBISE',
                  medium: setup?.medium === 'ur' ? 'Urdu' : 'English',
                })}
              </p>
              <p className="truncate text-[13.5px] text-ink2">{state.user?.contact}</p>

              <div className="mt-4 max-w-[420px]">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-extrabold text-ink">
                    {t('account.levelLine', { xp: state.xp, level: derived.level })}
                  </span>
                  <span className="text-[12px] font-extrabold text-ink2">
                    {t('account.toNextLevel', { n: xpToNextLevel(state.xp) })}
                  </span>
                </div>
                <div className="mt-1.5">
                  <Bar pct={levelProgress(state.xp)} />
                </div>
              </div>
            </div>
          </Card>

          {/* The class this account studies. One class at a time, by design. */}
          <Card className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-tealtint text-teal">
              <Icon name="award" size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-extrabold text-ink">{t('tutor.classRowValue', { n: classLevel })}</span>
              <span className="block text-[13px] text-ink2">{t('tutor.classWarnBody').split('.')[0]}.</span>
            </span>
            <Btn
              title={t('tutor.classChange')}
              variant="line"
              sm
              onClick={() => {
                const next = classLevel === 9 ? 10 : 9;
                if (next === 10 && !GRADE_10_READY) {
                  toast(t('onboarding.class10Toast'));
                  return;
                }
                setConfirmClass(next);
              }}
            />
          </Card>

          {/* What plan am I on */}
          <Link href="/account/subscription" className="block">
            <Card
              tint={state.premium.active ? 'bg-orangetint' : undefined}
              border={state.premium.active ? 'border-orange' : undefined}
              className="flex items-center gap-4 transition-colors duration-200 hover:border-teal"
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] ${
                  state.premium.active ? 'bg-orange text-white' : 'bg-grey text-ink2'
                }`}
              >
                <Icon name={state.premium.active ? 'crown' : 'lock'} size={22} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-extrabold text-ink">
                  {state.premium.active
                    ? `${t('account.premiumActive')} · ${planById(state.premium.plan ?? 'monthly').name}`
                    : t('account.freeMode')}
                </span>
                <span className="block text-[13px] text-ink2">
                  {state.premium.active && state.premium.validTill
                    ? t('account.premiumTill', {
                        date: new Date(state.premium.validTill).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
                      })
                    : t('account.freeModeSub')}
                </span>
              </span>
              {state.premium.active ? null : <Pill tone="orange">{t('account.upgrade')}</Pill>}
            </Card>
          </Link>

          {/* One switch for the app and the syllabus. Two controls let a
              student sit in an English app reading Urdu notes, and the two
              apps did not even agree on which one drove the content. */}
          <Card className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
            <div className="min-w-0">
              <p className="text-[14.5px] font-extrabold text-ink">{t('lang.label')}</p>
              <p className="text-[13px] text-ink2">{t('lang.oneSwitchSub')}</p>
            </div>
            <Seg
              value={s.language}
              onChange={(l: Language) => actions.setLanguage(l)}
              label={t('lang.label')}
              options={[
                { value: 'en' as Language, label: t('lang.english') },
                { value: 'ur' as Language, label: t('lang.urdu') },
              ]}
            />
          </Card>

          <CardGrid>
            <Group title={t('account.content')}>
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
                right={
                  <Toggle
                    on={s.streakAlerts}
                    label={t('account.streakAlerts')}
                    onClick={() => actions.setSettings({ streakAlerts: !s.streakAlerts })}
                  />
                }
              />
              <Item href="/notifications" title={t('account.notifications')} icon="bell" last />
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

            <Group title={t('account.storage')}>
              <Item href="/account/payments" title={t('account.paymentHistory')} icon="card" />
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
              <Item href="/account/help" title={t('account.help')} icon="help" />
              <Item href="/terms" title={t('account.terms')} icon="doc" />
              <Item title={t('account.version', { v: APP_VERSION })} icon="help" />
              <ItemButton
                title={t('auth.logOut')}
                icon="logout"
                tone="red"
                last
                right={<span />}
                onClick={() => setConfirmOut(true)}
              />
            </Group>
          </CardGrid>
        </Work>

        <Rail>
          <CoverageRail />
          <StreakRail />
        </Rail>
      </Split>

      <Sheet open={confirmClass !== null} onClose={() => setConfirmClass(null)} title={t('tutor.classWarnTitle', { n: confirmClass ?? 10 })}>
        <p className="text-[13.5px] leading-[1.6] text-ink2">{t('tutor.classWarnBody')}</p>
        <Btn
          title={t('tutor.classWarnCta')}
          variant="danger"
          className="mt-5 w-full"
          loading={switching}
          onClick={() => {
            if (confirmClass === null || switching) return;
            setSwitching(true);
            void actions.switchClass(confirmClass).then((r) => {
              setSwitching(false);
              setConfirmClass(null);
              if (r === 'ok') toast(t('tutor.classChanged', { n: confirmClass }));
              else toast(r === 'cooldown' ? t('tutor.classCooldown') : t('states.errorTitle'));
            });
          }}
        />
        <Btn title={t('common.cancel')} variant="ghost" className="mt-2 w-full" onClick={() => setConfirmClass(null)} />
      </Sheet>

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

      <Sheet open={confirmOut} onClose={() => setConfirmOut(false)} title={t('auth.logOutConfirm')}>
        <p className="text-[13.5px] text-ink2">{t('auth.logOutBody')}</p>
        <Btn
          title={t('auth.logOut')}
          variant="danger"
          className="mt-5 w-full"
          loading={signingOut}
          onClick={async () => {
            // The sheet stays open and the button spins until the server action
            // redirects; closing first left a signed-out shell with no feedback.
            setSigningOut(true);
            actions.signOut();
            try {
              await signOutAction();
            } catch {
              setSigningOut(false);
            }
          }}
        />
        <Btn title={t('auth.stayLoggedIn')} variant="ghost" className="mt-2 w-full" onClick={() => setConfirmOut(false)} />
      </Sheet>
    </Page>
  );
}
