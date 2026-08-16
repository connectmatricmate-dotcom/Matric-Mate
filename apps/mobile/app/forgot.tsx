import { useState } from 'react';
import { router } from 'expo-router';
import { useT } from '../src/i18n';
import { isAuthErrorKey, useAuth } from '../src/store/auth';
import { Body, Btn, Card, Field, Header, Screen, Small, Spacer } from '../src/components/ui';
import { Icon } from '../src/components/Icon';
import { C, S } from '../src/theme';

/**
 * Password reset, handled by Supabase.
 *
 * The link in the email opens the website, because that is where the form that
 * can set a password lives. Nothing here touches payment, so this is not a
 * steering problem: it is account recovery, which Play has no objection to.
 */
export default function Forgot() {
  const { requestPasswordReset } = useAuth();
  const t = useT();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = email.trim().includes('@');

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (e) {
      // The auth store hands back a string key, because it has no
      // language of its own to translate with.
      const key = e instanceof Error ? e.message : '';
      setError(isAuthErrorKey(key) ? t(key) : t('states.errorBody'));
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
          <Body style={{ textAlign: 'center', fontSize: 15 }}>{t('auth.resetSent', { contact: email.trim() })}</Body>
          <Spacer h={S.sm} />
          <Btn title={t('auth.backToLogin')} variant="line" sm onPress={() => router.replace('/login')} />
        </Card>
      ) : (
        <>
          {error ? <Body style={{ color: C.red, marginBottom: S.sm }}>{error}</Body> : null}
          <Field
            label={t('auth.contact')}
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.contactPlaceholder')}
            icon="mail"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Btn title={t('auth.sendReset')} onPress={submit} loading={busy} disabled={!valid} />
          <Small style={{ marginTop: S.sm }}>{t('auth.resetFootnote')}</Small>
        </>
      )}
    </Screen>
  );
}
