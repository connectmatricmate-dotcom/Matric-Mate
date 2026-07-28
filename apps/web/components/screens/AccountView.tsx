'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { levelProgress, xpToNextLevel } from '@matricmate/core';
import { planById } from '@/lib/plans';
import { Page, PageHead, Rail, Split, Work } from '@/components/app/Page';
import { CoverageRail, StreakRail } from '@/components/app/rails';
import { Btn, ItemButton } from '@/components/ui/controls';
import { Bar, Card, Item, LinkBtn, Pill } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { useApp, useT } from '@/lib/store';

export function AccountView() {
  const { state, actions, derived } = useApp();
  const t = useT();
  const router = useRouter();
  const [confirmOut, setConfirmOut] = useState(false);
  const setup = state.onboarding;

  return (
    <Page>
      <PageHead
        back="/dashboard"
        backLabel={t('tabs.home')}
        title={t('account.title')}
        actions={<LinkBtn title={t('account.editTitle')} href="/account/edit" variant="line" sm icon="edit" />}
      />

      <Split>
        <Work className="flex flex-col gap-4">
          <Card className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] bg-orangetint text-[32px]">
              🧑🏽‍🎓
            </span>
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

          <Link href="/account/subscription" className="block">
            <Card
              tint={state.premium.active ? 'bg-orangetint' : undefined}
              border={state.premium.active ? 'border-orange' : undefined}
              className="flex items-center gap-4 transition-colors duration-200 hover:border-teal"
            >
              <span className="text-[28px]">{state.premium.active ? '👑' : '🔓'}</span>
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

          <div className="grid gap-4 md:grid-cols-2">
            <Card flat className="py-0">
              <Item href="/account/payments" title={t('account.paymentHistory')} icon="card" />
              <Item
                href="/learn/downloads"
                title={t('account.downloads')}
                sub={t('account.downloadsSub', { n: state.downloads.length })}
                icon="download"
              />
              <Item href="/notifications" title={t('account.notifications')} icon="bell" last />
            </Card>

            <Card flat className="py-0">
              <Item href="/account/settings" title={t('account.settings')} icon="gear" />
              <Item href="/account/help" title={t('account.help')} icon="help" />
              <ItemButton
                title={t('auth.logOut')}
                icon="logout"
                tone="red"
                last
                right={<span />}
                onClick={() => setConfirmOut(true)}
              />
            </Card>
          </div>

          <p className="text-center text-[12.5px] text-ink3">{t('account.version', { v: '0.1.0' })}</p>
        </Work>

        <Rail>
          <CoverageRail />
          <StreakRail />
        </Rail>
      </Split>

      <Sheet open={confirmOut} onClose={() => setConfirmOut(false)} title={t('auth.logOutConfirm')}>
        <p className="text-[13.5px] text-ink2">{t('auth.logOutBody')}</p>
        <Btn
          title={t('auth.logOut')}
          variant="danger"
          className="mt-5 w-full"
          onClick={() => {
            setConfirmOut(false);
            actions.signOut();
            router.replace('/');
          }}
        />
        <Btn title={t('auth.stayLoggedIn')} variant="ghost" className="mt-2 w-full" onClick={() => setConfirmOut(false)} />
      </Sheet>
    </Page>
  );
}
