import { useState } from 'react';
import { router } from 'expo-router';
import { api } from '../src/core/api';
import { Body, Btn, Card, Field, Header, Screen, Small } from '../src/components/ui';
import { C, S } from '../src/theme';
import { Icon } from '../src/components/Icon';

export default function Forgot() {
  const [contact, setContact] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.requestPasswordReset(contact);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the reset link.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Header title="Reset password" sub="We’ll send you a reset link" back />
      {sent ? (
        <Card tint={C.greenTint} border={C.green} style={{ alignItems: 'center', gap: S.sm, paddingVertical: 26 }}>
          <Icon name="check" size={34} color={C.green} strokeWidth={2.6} />
          <Body style={{ textAlign: 'center', fontSize: 15 }}>
            Reset link sent to {contact} — check your inbox or SMS.
          </Body>
          <Btn title="Back to log in" variant="line" sm onPress={() => router.replace('/login')} />
        </Card>
      ) : (
        <>
          {error ? <Body style={{ color: C.red, marginBottom: S.sm }}>{error}</Body> : null}
          <Field label="Email or mobile number" value={contact} onChangeText={setContact} placeholder="ahmed@gmail.com" icon="send" />
          <Btn title="Send reset link" onPress={submit} loading={busy} />
          <Small style={{ marginTop: S.sm }}>
            For your security we send the same confirmation whether or not the account exists.
          </Small>
        </>
      )}
    </Screen>
  );
}
