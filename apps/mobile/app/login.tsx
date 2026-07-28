import { useState } from 'react';
import { Image, View } from 'react-native';
import { router } from 'expo-router';
import { api } from '../src/core/api';
import { useApp } from '../src/store/app';
import { Body, Btn, Card, Field, Header, Screen, Small } from '../src/components/ui';
import { C, S } from '../src/theme';

export default function Login() {
  const { state, actions } = useApp();
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign you in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Header title="Welcome back" sub="Chalo, continue karte hain" back />
      <Image
        source={require('../assets/monogram.png')}
        style={{ width: 130, height: 100, alignSelf: 'center', marginVertical: S.md }}
        resizeMode="contain"
      />
      {error ? (
        <Card flat tint={C.redTint} border={C.red} style={{ marginBottom: S.md }}>
          <Body style={{ color: C.red, fontSize: 13.5 }}>{error}</Body>
        </Card>
      ) : null}
      <Field label="Email or mobile number" value={contact} onChangeText={setContact} placeholder="ahmed@gmail.com" icon="send" />
      <Field label="Password" value={password} onChangeText={setPassword} placeholder="Your password" icon="lock" secure />
      <Btn title="Log in" onPress={submit} loading={busy} />
      <View style={{ height: S.sm }} />
      <Btn title="Forgot password?" variant="ghost" onPress={() => router.push('/forgot')} />
      <Small style={{ textAlign: 'center', marginTop: S.sm }}>
        Demo build: any email and a 6-character password will sign you in.
      </Small>
    </Screen>
  );
}
