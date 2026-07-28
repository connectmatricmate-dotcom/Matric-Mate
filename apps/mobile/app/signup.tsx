import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { api } from '../src/core/api';
import { useApp } from '../src/store/app';
import { Btn, Card, Field, Header, Screen, Small, Body } from '../src/components/ui';
import { C, S } from '../src/theme';

export default function SignUp() {
  const { actions } = useApp();
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
      router.replace('/paywall');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create your account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Header title="Create your account" sub="Two minutes — then straight to your plan" back />
      {error ? (
        <Card flat tint={C.redTint} border={C.red} style={{ marginBottom: S.md }}>
          <Body style={{ color: C.red, fontSize: 13.5 }}>{error}</Body>
        </Card>
      ) : null}
      <Field label="Full name" value={name} onChangeText={setName} placeholder="Ahmed Raza" icon="user" autoCapitalize="words" />
      <Field
        label="Email or mobile number"
        value={contact}
        onChangeText={setContact}
        placeholder="ahmed@gmail.com or 03001234567"
        icon="send"
      />
      <Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 6 characters" icon="lock" secure />
      <Small style={{ marginBottom: S.md }}>
        By continuing you agree to the Terms and Privacy Policy. Mobile OTP verification arrives in a later
        milestone — for now a password is enough.
      </Small>
      <Btn title="Create account" onPress={submit} loading={busy} />
      <View style={{ height: S.sm }} />
      <Btn title="I already have an account" variant="ghost" onPress={() => router.replace('/login')} />
    </Screen>
  );
}
