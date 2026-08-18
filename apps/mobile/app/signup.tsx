import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useT } from '../src/i18n';
import { useApp } from '../src/store/app';
import { isAuthErrorKey, useAuth } from '../src/store/auth';
import { Body, Btn, Card, Field, Header, Screen, Small, Spacer, useToast } from '../src/components/ui';
import { Icon } from '../src/components/Icon';
import { C, S } from '../src/theme';

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
  const { state } = useApp();
  const t = useT();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);
  const [resending, setResending] = useState(false);
  const toast = useToast();

  const valid = name.trim().length >= 2 && email.trim().includes('@') && password.length >= 6;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { needsConfirmation } = await signUp(name, email, password);
      // With confirmation on there is no session yet, so there is nowhere to go.
      // Saying so is the only honest option; routing into the app would land on
      // a locked screen and read as a failure.
      if (needsConfirmation) setConfirmSent(true);
      // Onboarding runs before sign-up on this app, so anyone arriving here has
      // already chosen their class and subjects. Sending them back through it
      // would look like the account did not save.
      else router.replace(state.onboarding?.subjects?.length ? '/(tabs)' : '/onboarding/class');
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
      />
      <Field
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        placeholder={t('auth.passwordPlaceholder')}
        icon="key"
        secure
      />
      <Small style={{ marginBottom: S.md }}>{t('auth.terms')}</Small>
      <Btn title={t('auth.createAccount')} onPress={submit} loading={busy} disabled={!valid} />
      <Spacer h={S.sm} />
      <Btn title={t('welcome.haveAccount')} variant="ghost" onPress={() => router.replace('/login')} />
      <Small style={{ textAlign: 'center', marginTop: S.xs }}>{t('auth.accountNote')}</Small>
      <View style={{ height: S.md }} />
    </Screen>
  );
}
