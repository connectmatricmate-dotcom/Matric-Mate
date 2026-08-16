import { useState } from 'react';
import { Image } from 'react-native';
import { router } from 'expo-router';
import { useT } from '../src/i18n';
import { isAuthErrorKey, useAuth } from '../src/store/auth';
import { Body, Btn, Card, Field, Header, Screen, Small, Spacer } from '../src/components/ui';
import { C, S } from '../src/theme';

/**
 * Signing in to the same Supabase account the website uses.
 *
 * A student who paid on the website and then installed the app arrives here,
 * and their premium is waiting because entitlement is read from the server. It
 * is never granted on this device.
 */
export default function Login() {
  const { signIn } = useAuth();
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = email.trim().includes('@') && password.length >= 6;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      // The splash gate decides where to land, AFTER this account's state has
      // hydrated. Deciding here read the previous user's cached onboarding,
      // so on a shared phone the new student inherited someone else's
      // subjects, and a restored account was marched through onboarding.
      router.replace('/');
    } catch (e) {
      // The auth store hands back a string key, because it has no
      // language of its own to translate with.
      const key = e instanceof Error ? e.message : '';
      setError(isAuthErrorKey(key) ? t(key) : t('states.errorBody'));
      setBusy(false);
    }
  }

  return (
    <Screen avoidKeyboard>
      <Header title={t('auth.loginTitle')} sub={t('auth.loginSub')} back />
      <Image
        source={require('../assets/monogram.png')}
        style={{ width: 124, height: 96, alignSelf: 'center', marginVertical: S.md }}
        resizeMode="contain"
      />
      {error ? (
        <Card flat tint={C.redTint} border={C.red} style={{ marginBottom: S.md }}>
          <Body style={{ color: C.red, fontSize: 13.5 }}>{error}</Body>
        </Card>
      ) : null}
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
        placeholder={t('auth.password')}
        icon="key"
        secure
      />
      <Btn title={t('auth.logIn')} onPress={submit} loading={busy} disabled={!valid} />
      <Spacer h={S.sm} />
      <Btn title={t('auth.forgotPassword')} variant="ghost" onPress={() => router.push('/forgot')} />
      <Small style={{ textAlign: 'center', marginTop: S.sm }}>{t('auth.accountNote')}</Small>
    </Screen>
  );
}
