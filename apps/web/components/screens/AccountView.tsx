'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Language } from '@matricmate/core';
import { GRADE_10_READY, REMINDER_TIMES, boardName, formatDate, levelProgress, mediumName, xpToNextLevel } from '@matricmate/core';
import { signOutAction } from '@/app/(auth)/actions';
import { planName } from '@/lib/plans';
import { APP_VERSION } from '@/lib/site';
import { CardGrid, Page, PageHead, Rail, Split, Work } from '@/components/app/Page';
import { CoverageRail, StreakRail } from '@/components/app/rails';
import { AvatarBadge } from '@/components/ui/AvatarBadge';
import { Btn, ItemButton, Seg, Toggle } from '@/components/ui/controls';
import { useToast } from '@/components/ui/toast';
import { Bar, Card, Icon, Item, Label, LinkBtn, Pill } from '@/components/ui/primitives';
import { Confirm, Sheet } from '@/components/ui/sheet';
import { pushPermission, registerWebPush, releaseWebPush } from '@/lib/web-push';
import { useApp, useLang, useT } from '@/lib/store';

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
  const { lang } = useLang();
  const [confirmOut, setConfirmOut] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClass, setConfirmClass] = useState<9 | 10 | null>(null);
  const [pickTime, setPickTime] = useState(false);
  /** null where the browser cannot do push at all, so the row shows the switch. */
  const [pushState, setPushState] = useState<NotificationPermission | null>(null);
  const [enabling, setEnabling] = useState(false);
  useEffect(() => {
    void pushPermission().then(setPushState);
  }, []);
  const [switching, setSwitching] = useState(false);
  const toast = useToast();
  const classLevel = state.onboarding?.classLevel ?? 9;
  const [signingOut, setSigningOut] = useState(false);
  const setup = state.onboarding;
  const s = state.settings;
  const sizeLabel = [t('reader.small'), t('reader.medium'), t('reader.large')][s.fontScale];
  const unreadCount = state.notifications.filter((n) => !n.read).length;

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
              <p className="font-display text-[20px] text-ink">{state.user?.name ?? t('common.student')}</p>
              <p className="text-[13.5px] text-ink2">
                {t('account.classLine', {
                  class: setup?.classLevel ?? 9,
                  board: boardName(setup?.board, lang),
                  medium: mediumName(setup?.medium, lang),
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
              <span className="block text-[15px] font-extrabold text-ink">{t('tutor.classRowValue', { n: classLevel, board: boardName(state.onboarding?.board, lang) })}</span>
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
                  state.premium.active ? 'bg-orange text-onbrand' : 'bg-grey text-ink2'
                }`}
              >
                <Icon name={state.premium.active ? 'crown' : 'lock'} size={22} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-extrabold text-ink">
                  {state.premium.active
                    ? `${t('account.premiumActive')} · ${planName(state.premium.plan ?? 'monthly', lang)}`
                    : t('account.freeMode')}
                </span>
                <span className="block text-[13px] text-ink2">
                  {state.premium.active && state.premium.validTill
                    ? t('account.premiumTill', {
                        date: formatDate(state.premium.validTill, lang, { day: 'numeric', month: 'short' }),
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
                { value: 'ur' as Language, label: t('lang.urdu'), urdu: true },
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
              {/* The row opens the picker, the switch turns it off. The time
                  was displayed and unchangeable, so it read as a promise the
                  app had made to itself: every student saw 7:00 PM whatever
                  suited them. */}
              <ItemButton
                title={t('account.studyReminder')}
                sub={t('account.studyReminderSub', { time: s.reminderTime })}
                icon="bell"
                onClick={() => setPickTime(true)}
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
              {/* The count is the only thing that makes the inbox
                  discoverable: nothing else in the app points at it. */}
              {/* Which notifications exist is above. This is how they reach
                  the student, which is a different question: someone can want
                  a streak nudge on their phone and not in their inbox. */}
              {/* Two different things share this row, and only one of them is
                  ours. The switch is the student's preference, which the
                  server honours. Permission belongs to the browser, is asked
                  for once, and a refusal is close to permanent, so it is asked
                  from here where the row says what it is for, and never on
                  page load. */}
              <Item
                title={t('account.channelPush')}
                sub={t('account.channelPushSub')}
                icon="bell"
                right={
                  pushState === 'default' ? (
                    <Btn
                      title={t('account.channelPushEnable')}
                      variant="line"
                      sm
                      loading={enabling}
                      onClick={async () => {
                        if (!state.user) return;
                        setEnabling(true);
                        const r = await registerWebPush(true);
                        setPushState(r === 'registered' ? 'granted' : r === 'denied' ? 'denied' : null);
                        setEnabling(false);
                      }}
                    />
                  ) : (
                    <Toggle
                      on={s.channelPush}
                      label={t('account.channelPush')}
                      onClick={() => actions.setSettings({ channelPush: !s.channelPush })}
                    />
                  )
                }
              />
              <Item
                title={t('account.channelEmail')}
                sub={t('account.channelEmailSub')}
                icon="mail"
                right={
                  <Toggle
                    on={s.channelEmail}
                    label={t('account.channelEmail')}
                    onClick={() => actions.setSettings({ channelEmail: !s.channelEmail })}
                  />
                }
              />
              <Item
                href="/notifications"
                title={t('account.notifications')}
                icon="bell"
                last
                right={unreadCount ? <Pill tone="red">{String(unreadCount)}</Pill> : undefined}
              />
            </Group>

            <Group title={t('account.appearance')}>
              <Item
                title={t('account.darkMode')}
                sub={t('account.darkModeSub')}
                icon="moon"
                last
                right={
                  <Toggle
                    on={s.dark}
                    label={t('account.darkMode')}
                    onClick={() => actions.setSettings({ dark: !s.dark })}
                  />
                }
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
              {/* Play requires the deletion route to be reachable from inside
                  the product, not only from the marketing footer. */}
              <Item
                href="/delete-account"
                title={t('account.deleteAccount')}
                sub={t('account.deleteAccountSub')}
                icon="trash"
                tone="red"
              />
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

      <Sheet open={pickTime} onClose={() => setPickTime(false)} title={t('account.reminderTimeTitle')}>
        <Card flat className="py-0">
          {REMINDER_TIMES.map((time, i) => (
            <ItemButton
              key={time}
              title={time}
              icon={time === s.reminderTime ? 'check' : 'clock'}
              tone={time === s.reminderTime ? 'green' : 'grey'}
              last={i === REMINDER_TIMES.length - 1}
              onClick={() => {
                actions.setSettings({ reminderTime: time });
                setPickTime(false);
              }}
            />
          ))}
        </Card>
      </Sheet>

      <Confirm
        open={confirmClass !== null}
        onClose={() => setConfirmClass(null)}
        title={t('tutor.classWarnTitle', { n: confirmClass ?? 10 })}
        body={t('tutor.classWarnBody')}
        confirmLabel={t('tutor.classWarnCta')}
        cancelLabel={t('common.cancel')}
        loading={switching}
        onConfirm={() => {
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

      <Confirm
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title={t('account.resetDemo')}
        body={t('account.resetDemoSub')}
        confirmLabel={t('account.resetDemo')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          actions.resetDemo();
          setConfirmReset(false);
          toast(t('account.resetDone'));
        }}
      />

      <Confirm
        open={confirmOut}
        onClose={() => setConfirmOut(false)}
        title={t('auth.logOutConfirm')}
        body={t('auth.logOutBody')}
        confirmLabel={t('auth.logOut')}
        cancelLabel={t('auth.stayLoggedIn')}
        loading={signingOut}
        onConfirm={async () => {
          // The sheet stays open and the button spins until the server action
          // redirects; closing first left a signed-out shell with no feedback.
          setSigningOut(true);
          // Before the session goes: the browser has to be handed back while
          // we can still prove who is handing it over.
          await releaseWebPush();
          actions.signOut();
          try {
            await signOutAction();
          } catch {
            setSigningOut(false);
          }
        }}
      />
    </Page>
  );
}
