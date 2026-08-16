import Constants from 'expo-constants';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  Bar,
  Btn,
  Card,
  Header,
  IconButton,
  Item,
  Pill,
  Row,
  Screen,
  SectionTitle,
  Seg,
  Sheet,
  Small,
  Spacer,
  Toggle,
  useToast,
} from '../../src/components/ui';
import { GRADE_10_READY, Language, boardName, formatDate, levelProgress, mediumName, xpToNextLevel } from '@matricmate/core';
import { useLang, useT } from '../../src/i18n';
import { AvatarBadge } from '../../src/components/AvatarBadge';
import { useApp } from '../../src/store/app';
import { useAuth } from '../../src/store/auth';
import { C, F, S } from '../../src/theme';

/**
 * The ONE settings surface. There used to be two: the avatar opened
 * "Account" and the gear opened "Settings", and nobody could predict which
 * of their things lived where (the client's own words). Everything now
 * lives here, ordered by how often a student actually touches it: who am I,
 * what plan am I on, the study choices (class, medium, size, language),
 * then the long tail. /account/settings redirects here so old links hold.
 */
export default function Account() {
  const { state, actions, derived } = useApp();
  const { signOut } = useAuth();
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const [confirmOut, setConfirmOut] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClass, setConfirmClass] = useState<9 | 10 | null>(null);
  const [switching, setSwitching] = useState(false);
  const setup = state.onboarding;
  const classLevel = setup?.classLevel ?? 9;
  const s = state.settings;
  const sizeLabel = [t('reader.small'), t('reader.medium'), t('reader.large')][s.fontScale];

  return (
    <>
      <Screen>
        <Header title={t('account.settingsTitle')} back />

        {/* Who am I */}
        <Card onPress={() => router.push('/account/edit')}>
          <Row gap={S.md}>
            <AvatarBadge index={s.avatar ?? 0} size={56} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontFamily: F.bodyBold, fontSize: 16, color: C.ink }}>{state.user?.name ?? t('common.student')}</Text>
              <Small>
                {t('account.classLine', {
                  class: classLevel,
                  board: boardName(setup?.board, lang),
                  medium: mediumName(setup?.medium, lang),
                })}
              </Small>
              <Small numberOfLines={1}>{state.user?.contact}</Small>
            </View>
            <IconButton icon="edit" tone="card" onPress={() => router.push('/account/edit')} />
          </Row>
        </Card>

        {/* What plan am I on */}
        <Spacer h={S.md} />
        <Card
          tint={state.premium.active ? C.orangeTint : undefined}
          border={state.premium.active ? C.orange : undefined}
          onPress={() => router.push('/account/subscription')}
        >
          <Row gap={S.md}>
            <Text style={{ fontSize: 24 }}>{state.premium.active ? '👑' : '🔓'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.bodyBold, fontSize: 14.5, color: C.ink }}>
                {state.premium.active ? t('account.premiumActive') : t('account.freeMode')}
              </Text>
              <Small>
                {state.premium.active && state.premium.validTill
                  ? t('account.premiumTill', {
                      date: formatDate(state.premium.validTill, lang, { day: 'numeric', month: 'short' }),
                    })
                  : t('account.freeModeSub')}
              </Small>
            </View>
            {/* No "Upgrade" call to action: Play treats that as steering to an
                out-of-Play purchase. The row still opens the read-only plan
                screen, which explains the position without selling anything. */}
            <Pill tone={state.premium.active ? 'green' : 'grey'}>
              {state.premium.active ? t('account.active') : t('billing.statusFree')}
            </Pill>
          </Row>
        </Card>

        <Spacer h={S.md} />
        <Card>
          <Row gap={S.md}>
            <Text style={{ fontSize: 22 }}>⚡</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.ink }}>
                {t('account.levelLine', { xp: state.xp, level: derived.level })}
              </Text>
              <View style={{ marginTop: 8 }}>
                <Bar pct={levelProgress(state.xp)} />
              </View>
            </View>
            <Small style={{ fontFamily: F.bodyBold }}>{t('account.toNextLevel', { n: xpToNextLevel(state.xp) })}</Small>
          </Row>
        </Card>

        {/* The study choices, the settings a student actually changes */}
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
          {/* One switch for the app and the syllabus. Two controls let a
              student sit in an English app reading Urdu notes, and nobody
              wanted that combination. */}
          <Item
            title={t('lang.label')}
            sub={t('lang.oneSwitchSub')}
            icon="book2"
            right={
              <View style={{ width: 118 }}>
                <Seg<Language>
                  value={s.language}
                  onChange={(next) => actions.setLanguage(next)}
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
            right={<Toggle on={false} onPress={() => toast(t('onboarding.comingSoon'))} />}
          />
          <Item title={t('account.notifications')} icon="bell" last onPress={() => router.push('/notifications')} />
        </Card>

        <SectionTitle>{t('account.storage')}</SectionTitle>
        <Card flat style={{ paddingVertical: 0 }}>
          <Item
            title={t('account.manageDownloads')}
            sub={t('account.chaptersCount', { n: state.downloads.length })}
            icon="download"
            onPress={() => router.push('/learn/downloads')}
          />
          <Item title={t('account.paymentHistory')} icon="card" onPress={() => router.push('/account/payments')} />
          <Item
            title={t('account.resetDemo')}
            sub={t('account.resetDemoSub')}
            icon="trash"
            tone="red"
            last
            onPress={() => setConfirmReset(true)}
          />
        </Card>

        <SectionTitle>{t('account.about')}</SectionTitle>
        <Card flat style={{ paddingVertical: 0 }}>
          <Item title={t('account.help')} icon="help" onPress={() => router.push('/account/help')} />
          <Item title={t('account.terms')} icon="doc" onPress={() => toast(t('account.termsToast'))} />
          <Item title={t('account.version', { v: Constants.expoConfig?.version ?? '' })} icon="help" />
          <Item title={t('auth.logOut')} icon="logout" tone="red" last onPress={() => setConfirmOut(true)} right={<View />} />
        </Card>

        <Spacer h={S.lg} />
      </Screen>

      <Sheet visible={confirmOut} onClose={() => setConfirmOut(false)} title={t('auth.logOutConfirm')}>
        <Small>{t('auth.logOutBody')}</Small>
        <Spacer h={S.lg} />
        <Btn
          title={t('auth.logOut')}
          variant="danger"
          onPress={async () => {
            setConfirmOut(false);
            // Ends the Supabase session and clears the cached entitlement, so
            // the next person to open this phone starts from nothing.
            await signOut();
            router.replace('/welcome');
          }}
        />
        <Spacer h={S.sm} />
        <Btn title={t('auth.stayLoggedIn')} variant="ghost" onPress={() => setConfirmOut(false)} />
      </Sheet>

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
    </>
  );
}
