import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { api } from '@matricmate/core';
import { useT } from '../src/i18n';
import { useApp } from '../src/store/app';
import { Body, Btn, Card, Field, Header, Screen, Small, Spacer } from '../src/components/ui';
import { C, S } from '../src/theme';

export default function SignUp() {
  const { actions } = useApp();
  const t = useT();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const user = await api.signUp({ name, contact, password });
      actions.signIn(user);
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create your account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen avoidKeyboard>
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
        value={contact}
        onChangeText={setContact}
        placeholder={t('auth.contactPlaceholder')}
        icon="mail"
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
      <Btn title={t('auth.createAccount')} onPress={submit} loading={busy} />
      <Spacer h={S.sm} />
      <Btn title={t('welcome.haveAccount')} variant="ghost" onPress={() => router.replace('/login')} />
      <View style={{ height: S.md }} />
    </Screen>
  );
}
