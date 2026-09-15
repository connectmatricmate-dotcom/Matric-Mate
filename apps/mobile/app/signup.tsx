import { useState } from 'react';
import { Linking, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useT } from '../src/i18n';
import { cleanTeacherCode, isAuthErrorKey, teacherCodeOk, useAuth } from '../src/store/auth';
import { Body, Btn, Card, Field, Header, Screen, Small, Spacer, Text, useToast } from '../src/components/ui';
import { isPlausibleEmail, normaliseMobile } from '@matricmate/core';
import { Icon } from '../src/components/Icon';
import { SITE_URL } from '../src/lib/site';
import { C, F, S } from '../src/theme';
import { resetTo } from '../src/core/nav';

/**
 * Creating an account, in the app, on purpose.
 *
 * Google Play's payments policy governs selling, not sign-up, so a free account
 * is allowed here and nothing about it is a purchase. It also matters
 * commercially: an account is an email address, and email is the only channel
 * Play permits for telling a student about a plan they could buy on the
 * website. Without it there is no compliant way to ever reach them.
 *
 * What this screen must never grow: a price, a plan, or a way to pay.
 */
export default function SignUp() {
  const { signUp, resendConfirmation } = useAuth();
  /** 'onboarding' when the subject step sent them here, having just chosen. */
  const { from } = useLocalSearchParams<{ from?: string }>();
  const t = useT();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [mobileTouched, setMobileTouched] = useState(false);
  const [school, setSchool] = useState('');
  const [teacherCode, setTeacherCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);
  const [resending, setResending] = useState(false);
  const toast = useToast();

  // Optional, but when given it has to fit the column (2 to 120 letters), the website's rule.
  const schoolClean = school.trim().replace(/\s+/g, ' ');
  const schoolOk = !schoolClean || (schoolClean.length >= 2 && schoolClean.length <= 120);
  // Optional too, and held to the website's shape for a code.
  const code = cleanTeacherCode(teacherCode);
  const codeOk = !code || teacherCodeOk(code);
  const mobileOk = !!normaliseMobile(mobile);
  // The same rule as the website and the server: `name@gmail` has an @ but
  // can never receive the password-reset email.
  const emailOk = isPlausibleEmail(email);
  const othersOk = name.trim().length >= 2 && emailOk && password.length >= 6 && schoolOk && codeOk;
  const valid = othersOk && mobileOk;
  /*
   * Said under the field, not left for the button to explain by staying grey:
   * a number that does not read as Pakistani disabled "Create account" with no
   * reason given. Once the field is left, once it is long enough to judge, or
   * when it is the only thing still wrong.
   */
  const mobileError =
    !!mobile.trim() && !mobileOk && (mobileTouched || mobile.replace(/\D/g, '').length >= 11 || othersOk)
      ? t('auth.errMobileInvalid')
      : undefined;

  async function openDoc(path: '/terms' | '/privacy') {
    // ?from=app: the bare page, with no navigation on to the plans (core/billing.ts).
    try {
      await Linking.openURL(`${SITE_URL}${path}?from=app`);
    } catch {
      toast(t('common.openLinkError'));
    }
  }

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { needsConfirmation, refMissed } = await signUp(name, email, password, mobile, schoolClean, code);
      // The account is made either way; a code that matched nobody is worth
      // knowing now, while the teacher can still be asked for the right one.
      if (refMissed) toast(t('auth.teacherCodeMissed'));
      // With confirmation on there is no session yet, so there is nowhere to go.
      // Saying so is the only honest option; routing into the app would land on
      // a locked screen and read as a failure.
      if (needsConfirmation) setConfirmSent(true);
      // Onboarding runs before sign-up on this app, so a student who came from
      // it has chosen already and goes on. One who came from Log in, "Create
      // account", has not, and goes through it. Decided by where they came
      // from, not by choices on the phone: after a sign-out those can be the
      // previous student's, and a new account used to skip onboarding on them.
      else resetTo(from === 'onboarding' ? '/(tabs)' : '/onboarding/class');
    } catch (e) {
      // The auth store hands back a string key, because it has no
      // language of its own to translate with.
      const key = e instanceof Error ? e.message : '';
      setError(isAuthErrorKey(key) ? t(key) : t('states.errorBody'));
    } finally {
      setBusy(false);
    }
  }

  if (confirmSent) {
    return (
      <Screen>
        <Header title={t('auth.checkInboxTitle')} back />
        <Card tint={C.greenTint} border={C.green} style={{ alignItems: 'center', gap: S.sm, paddingVertical: 26 }}>
          <Icon name="mail" size={34} color={C.green} strokeWidth={2.4} />
          <Body style={{ textAlign: 'center', fontSize: 15 }}>{t('auth.checkInboxBody', { email: email.trim() })}</Body>
          <Spacer h={S.sm} />
          {/* Without this, an email that went to spam is a dead end: they
              cannot sign in, and signing up again says "already registered". */}
          <Btn
            title={t('auth.resendConfirm')}
            variant="line"
            sm
            loading={resending}
            onPress={async () => {
              setResending(true);
              try {
                await resendConfirmation(email);
                toast(t('auth.resendConfirmDone'));
              } catch {
                toast(t('auth.resendConfirmFail'));
              } finally {
                setResending(false);
              }
            }}
          />
          <Spacer h={S.sm} />
          <Btn title={t('auth.backToLogin')} variant="ghost" sm onPress={() => router.replace('/login')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={t('auth.signUpTitle')} sub={t('auth.signUpSub')} back />
      {error ? (
        <Card flat tint={C.redTint} border={C.red} style={{ marginBottom: S.md }}>
          <Body style={{ color: C.red, fontSize: 13.5 }}>{error}</Body>
        </Card>
      ) : null}
      <Field
        label={t('auth.fullName')}
        value={name}
        onChangeText={setName}
        placeholder={t('auth.namePlaceholder')}
        icon="user"
        autoCapitalize="words"
      />
      <Field
        label={t('auth.contact')}
        value={email}
        onChangeText={setEmail}
        placeholder={t('auth.contactPlaceholder')}
        icon="mail"
        keyboardType="email-address"
        autoCapitalize="none"
        error={email.trim() && !emailOk && email.includes('.') ? t('auth.errEmailInvalid') : undefined}
      />
      {/* Asked here so it is never asked at checkout. Safepay will not create
          the payer record that fills its own form in without a number, and a
          new field in front of somebody deciding whether to pay is a reason to
          stop. The website asks for it in the same place, so one account looks
          the same whichever app made it. */}
      <Field
        label={t('auth.mobile')}
        value={mobile}
        onChangeText={setMobile}
        onBlur={() => setMobileTouched(true)}
        placeholder={t('auth.mobilePlaceholder')}
        icon="phone"
        keyboardType="phone-pad"
        autoCapitalize="none"
        error={mobileError}
      />
      {/* Optional, and the label says so. The client counts students by school
          and plans school batches from it; nobody is kept from studying for
          not wanting to say. */}
      <Field
        label={t('auth.school')}
        value={school}
        onChangeText={setSchool}
        placeholder={t('auth.schoolPlaceholder')}
        icon="gradCap"
        autoCapitalize="words"
        error={schoolOk ? undefined : t('auth.errSchoolLength')}
      />
      <Field
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        placeholder={t('auth.passwordPlaceholder')}
        icon="key"
        secure
      />
      {/* A student who signs up here never passes the teacher's link the
          website reads, so the code the teacher handed out is asked for. */}
      <Field
        label={t('auth.teacherCode')}
        value={teacherCode}
        onChangeText={setTeacherCode}
        placeholder={t('auth.teacherCodePlaceholder')}
        icon="award"
        autoCapitalize="characters"
        error={codeOk ? undefined : t('auth.errTeacherCode')}
      />
      {/* The two documents the sentence names, each one tap away. */}
      <Small style={{ marginBottom: S.md }}>
        {t('auth.agreeLine', { terms: '\u0000terms\u0000', privacy: '\u0000privacy\u0000' })
          .split('\u0000')
          .map((part, i) =>
            part === 'terms' || part === 'privacy' ? (
              <Text
                key={i}
                accessibilityRole="link"
                onPress={() => void openDoc(part === 'terms' ? '/terms' : '/privacy')}
                style={{ fontFamily: F.bodyBold, color: C.teal, textDecorationLine: 'underline' }}
              >
                {t(part === 'terms' ? 'auth.termsWord' : 'auth.privacyWord')}
              </Text>
            ) : (
              part
            ),
          )}
      </Small>
      <Btn title={t('auth.createAccount')} onPress={submit} loading={busy} disabled={!valid} />
      <Spacer h={S.sm} />
      <Btn title={t('welcome.haveAccount')} variant="ghost" onPress={() => router.replace('/login')} />
      <Small style={{ textAlign: 'center', marginTop: S.xs }}>{t('auth.accountNote')}</Small>
      <View style={{ height: S.md }} />
    </Screen>
  );
}
