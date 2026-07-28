import { useState } from 'react';
import { router } from 'expo-router';
import { api } from '@matricmate/core';
import { useT } from '../src/i18n';
import { Body, Btn, Card, Field, Header, Screen, Small, Spacer } from '../src/components/ui';
import { Icon } from '../src/components/Icon';
import { C, S } from '../src/theme';

export default function Forgot() {
  const t = useT();
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
      setError(e instanceof Error ? e.message : t('states.errorBody'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen avoidKeyboard>
      <Header title={t('auth.resetTitle')} sub={t('auth.resetSub')} back />
      {sent ? (
        <Card tint={C.greenTint} border={C.green} style={{ alignItems: 'center', gap: S.sm, paddingVertical: 26 }}>
          <Icon name="check" size={34} color={C.green} strokeWidth={2.6} />
          <Body style={{ textAlign: 'center', fontSize: 15 }}>{t('auth.resetSent', { contact })}</Body>
          <Spacer h={S.sm} />
          <Btn title={t('auth.backToLogin')} variant="line" sm onPress={() => router.replace('/login')} />
        </Card>
      ) : (
        <>
          {error ? <Body style={{ color: C.red, marginBottom: S.sm }}>{error}</Body> : null}
          <Field
            label={t('auth.contact')}
            value={contact}
            onChangeText={setContact}
            placeholder={t('auth.contactPlaceholder')}
            icon="mail"
          />
          <Btn title={t('auth.sendReset')} onPress={submit} loading={busy} />
          <Small style={{ marginTop: S.sm }}>{t('auth.resetFootnote')}</Small>
        </>
      )}
    </Screen>
  );
}
