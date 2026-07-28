import { useState } from 'react';
import { Image } from 'react-native';
import { router } from 'expo-router';
import { api } from '../src/core/api';
import { useT } from '../src/i18n';
import { useApp } from '../src/store/app';
import { Body, Btn, Card, Field, Header, Screen, Small, Spacer } from '../src/components/ui';
import { C, S } from '../src/theme';

export default function Login() {
  const { state, actions } = useApp();
  const t = useT();
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const user = await api.signIn({ contact, password });
      actions.signIn(user);
      router.replace(state.onboarding?.subjects?.length ? '/(tabs)' : '/onboarding/class');
    } catch {
      setError(t('auth.demoHint'));
    } finally {
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
        value={contact}
        onChangeText={setContact}
        placeholder={t('auth.contactPlaceholder')}
        icon="mail"
      />
      <Field
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        placeholder={t('auth.password')}
        icon="key"
        secure
      />
      <Btn title={t('auth.logIn')} onPress={submit} loading={busy} />
      <Spacer h={S.sm} />
      <Btn title={t('auth.forgotPassword')} variant="ghost" onPress={() => router.push('/forgot')} />
      <Small style={{ textAlign: 'center', marginTop: S.sm }}>{t('auth.demoHint')}</Small>
    </Screen>
  );
}
