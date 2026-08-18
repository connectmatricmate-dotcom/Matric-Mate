import Constants from 'expo-constants';
import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  Bar,
  Card,
  Confirm,
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
import { GRADE_10_READY, Language, REMINDER_TIMES, boardName, formatDate, levelProgress, mediumName, xpToNextLevel } from '@matricmate/core';
import { useLang, useT } from '../../src/i18n';
import { AvatarBadge } from '../../src/components/AvatarBadge';
import { useApp } from '../../src/store/app';
import { useAuth } from '../../src/store/auth';
import { SITE_URL } from '../../src/lib/site';
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
  const [pickTime, setPickTime] = useState(false);
  const [switching, setSwitching] = useState(false);
  const setup = state.onboarding;
  const classLevel = setup?.classLevel ?? 9;
  const s = state.settings;
  const sizeLabel = [t('reader.small'), t('reader.medium'), t('reader.large')][s.fontScale];
  const unreadCount = state.notifications.filter((n) => !n.read).length;

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
                    { value: 'en', label: t('lang.english') },
                    { value: 'ur', label: t('lang.urdu'), urdu: true },
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
            right={<Toggle on={s.dark} onPress={() => actions.setSettings({ dark: !s.dark })} />}
          />
        </Card>

        <SectionTitle>{t('account.notificationsSection')}</SectionTitle>
        <Card flat style={{ paddingVertical: 0 }}>
          {/* The row opens the picker, the switch turns it off. The time was
              displayed and unchangeable, so it read as a promise the app had
              made to itself: every student saw 7:00 PM whatever suited them. */}
          <Item
            title={t('account.studyReminder')}
            sub={t('account.studyReminderSub', { time: s.reminderTime })}
            icon="bell"
            onPress={s.reminders ? () => setPickTime(true) : undefined}
            right={<Toggle on={s.reminders} onPress={() => actions.setSettings({ reminders: !s.reminders })} />}
          />
          <Item
            title={t('account.streakAlerts')}
            sub={t('account.streakAlertsSub')}
            icon="flame"
            tone="orange"
            right={<Toggle on={s.streakAlerts} onPress={() => actions.setSettings({ streakAlerts: !s.streakAlerts })} />}
          />
          {/* Which notifications exist is above. This is how they reach the
              student, which is a different question: someone can want a streak
              nudge on their phone and not in their inbox. */}
          <Item
            title={t('account.channelPush')}
            sub={t('account.channelPushSub')}
            icon="bell"
            right={<Toggle on={s.channelPush} onPress={() => actions.setSettings({ channelPush: !s.channelPush })} />}
          />
          <Item
            title={t('account.channelEmail')}
            sub={t('account.channelEmailSub')}
            icon="mail"
            right={<Toggle on={s.channelEmail} onPress={() => actions.setSettings({ channelEmail: !s.channelEmail })} />}
          />
          {/* The count is the only thing that makes the inbox discoverable:
              it is three taps deep and nothing else ever points at it. */}
          <Item
            title={t('account.notifications')}
            icon="bell"
            last
            right={unreadCount ? <Pill tone="red">{String(unreadCount)}</Pill> : undefined}
            onPress={() => router.push('/notifications')}
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
          {/* The toast here said legal pages would ship with the landing page.
              They did. Opening a page with no price and no checkout on it is
              not selling, so this stays within core/billing.ts. */}
          <Item
            title={t('account.terms')}
            icon="doc"
            onPress={async () => {
              try {
                await Linking.openURL(`${SITE_URL}/terms`);
              } catch {
                toast(t('common.openLinkError'));
              }
            }}
          />
          {/* Play requires the deletion route to be reachable from inside the
              app. The page is on the website because deleting has to work for
              someone who has already uninstalled. */}
          <Item
            title={t('account.deleteAccount')}
            sub={t('account.deleteAccountSub')}
            icon="trash"
            tone="red"
            onPress={async () => {
              try {
                await Linking.openURL(`${SITE_URL}/delete-account`);
              } catch {
                toast(t('common.openLinkError'));
              }
            }}
          />
          <Item title={t('account.version', { v: Constants.expoConfig?.version ?? '' })} icon="help" />
          <Item title={t('auth.logOut')} icon="logout" tone="red" last onPress={() => setConfirmOut(true)} right={<View />} />
        </Card>

        <Spacer h={S.lg} />
      </Screen>

      <Sheet visible={pickTime} onClose={() => setPickTime(false)} title={t('account.reminderTimeTitle')}>
        <Card flat style={{ paddingVertical: 0 }}>
          {REMINDER_TIMES.map((time, i) => (
            <Item
              key={time}
              title={time}
              icon={time === s.reminderTime ? 'check' : 'clock'}
              tone={time === s.reminderTime ? 'green' : 'grey'}
              last={i === REMINDER_TIMES.length - 1}
              onPress={() => {
                actions.setSettings({ reminderTime: time });
                setPickTime(false);
              }}
            />
          ))}
        </Card>
      </Sheet>

      <Confirm
        visible={confirmOut}
        onClose={() => setConfirmOut(false)}
        title={t('auth.logOutConfirm')}
        body={t('auth.logOutBody')}
        confirmLabel={t('auth.logOut')}
        cancelLabel={t('auth.stayLoggedIn')}
        onConfirm={async () => {
          setConfirmOut(false);
          // Ends the Supabase session and clears the cached entitlement, so
          // the next person to open this phone starts from nothing.
          await signOut();
          // The login form, not the welcome carousel. Somebody signing out has
          // already been introduced to the app; pitching it again and making
          // them swipe through three slides to reach a password field is the
          // wrong end of the funnel.
          router.replace('/login');
        }}
      />

      {/* One tap used to do it, no questions asked: local state, downloaded
          files AND server history, gone. That is the most destructive action
          in the app and the only one that had no confirm. */}
      <Confirm
        visible={confirmReset}
        onClose={() => setConfirmReset(false)}
        title={t('account.resetDemo')}
        body={t('account.resetDemoSub')}
        confirmLabel={t('account.resetDemo')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          setConfirmReset(false);
          actions.resetDemo();
          toast(t('account.resetDone'));
        }}
      />

      <Confirm
        visible={confirmClass !== null}
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
            if (r === 'ok') {
              toast(t('tutor.classChanged', { n: confirmClass }));
              router.replace('/(tabs)');
            } else {
              toast(r === 'cooldown' ? t('tutor.classCooldown') : t('states.errorTitle'));
            }
          });
        }}
      />
    </>
  );
}
