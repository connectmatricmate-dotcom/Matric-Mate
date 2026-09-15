import { useState } from 'react';
import { Linking, View } from 'react-native';
import { deleteAccount } from '@matricmate/core';
import { Btn, Card, Confirm, Field, Header, Item, Row, Screen, ScriptText, SectionTitle, Small, Spacer, useToast } from '../../src/components/ui';
import { Icon } from '../../src/components/Icon';
import type { IconName } from '../../src/components/Icon';
import { useOnline } from '../../src/core/connectivity';
import { resetTo } from '../../src/core/nav';
import { useT } from '../../src/i18n';
import type { StringKey } from '../../src/i18n';
import { markAccountDeleted } from '../../src/lib/first-run';
import { SITE_URL } from '../../src/lib/site';
import { supabase } from '../../src/lib/supabase';
import { forgetSavedQueue, useApp } from '../../src/store/app';
import { useAuth } from '../../src/store/auth';
import { C, S } from '../../src/theme';

const GONE: [IconName, StringKey][] = [
  ['user', 'deletion.gone1'],
  ['chart', 'deletion.gone2'],
  ['spark', 'deletion.gone3'],
  ['award', 'deletion.gone4'],
];

/** What the student types to unlock the button: the same word the server wants. */
const WORD = 'DELETE';

/**
 * Deleting the account, inside the app.
 *
 * Google Play wants deletion reachable from the app itself. The row in
 * Settings used to open the website's page, which asked for an email and left
 * a person to do the deleting by hand. Now it happens here: what goes and what
 * stays, the word typed to unlock the button, one last confirm, and the
 * server (POST /api/account/delete, see core/account.ts) removes the account
 * and everything on it. Payment records stay, without the account, for the
 * accounts. The website's page is still linked for the full explanation, and
 * for anyone who has already uninstalled.
 *
 * Nothing about plans, prices or refunds: the Android app names none
 * (core/billing.ts).
 */
export default function DeleteAccount() {
  const t = useT();
  const toast = useToast();
  const online = useOnline();
  const { state } = useApp();
  const { signOut } = useAuth();
  const [typed, setTyped] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const ready = typed.trim().toUpperCase() === WORD;

  async function openPage() {
    try {
      // ?from=app: the bare page, with no navigation on to the plans.
      await Linking.openURL(`${SITE_URL}/delete-account?from=app`);
    } catch {
      toast(t('common.openLinkError'));
    }
  }

  async function remove() {
    if (busy) return;
    if (!online) {
      setConfirming(false);
      toast(t('deletion.offline'));
      return;
    }
    setBusy(true);
    // The current token, refreshed if it had run out, not the one this screen
    // rendered with.
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const uid = state.user?.id ?? null;
    const res = token ? await deleteAccount(SITE_URL, token) : { ok: false as const, reason: 'error' as const };
    if (!res.ok) {
      setBusy(false);
      setConfirming(false);
      toast(t(res.reason === 'offline' ? 'deletion.offline' : 'deletion.failed'));
      return;
    }
    // The account is gone on the server. What this phone still holds for it
    // goes too: answers waiting to be sent for it, then the session and the
    // study copy (the store wipes itself on the way out, downloads included).
    if (uid) await forgetSavedQueue(uid);
    markAccountDeleted();
    await signOut({ deleted: true });
    resetTo('/welcome');
  }

  return (
    <Screen>
      <Header title={t('deletion.title')} back />

      <Card flat tint={C.redTint} border={C.red}>
        <Row gap={S.sm} style={{ alignItems: 'flex-start' }}>
          <Icon name="alert" size={18} color={C.red} />
          <Small style={{ flex: 1, color: C.ink }}>{t('deletion.intro')}</Small>
        </Row>
      </Card>

      <SectionTitle>{t('deletion.goneTitle')}</SectionTitle>
      <Card flat>
        <View style={{ gap: S.md }}>
          {GONE.map(([icon, key]) => (
            <Row key={key} gap={S.md} style={{ alignItems: 'flex-start' }}>
              <Icon name={icon} size={17} color={C.red} />
              {/* In its own script's face and leading: Nastaliq at a Latin line
                  height cropped the Urdu lines. */}
              <ScriptText text={t(key)} size={14} style={{ flex: 1 }} />
            </Row>
          ))}
        </View>
      </Card>

      <SectionTitle>{t('deletion.keptTitle')}</SectionTitle>
      <Card flat>
        <Row gap={S.md} style={{ alignItems: 'flex-start' }}>
          <Icon name="card" size={17} color={C.ink2} />
          <ScriptText text={t('deletion.kept1')} size={14} color={C.ink2} style={{ flex: 1 }} />
        </Row>
      </Card>

      <Spacer h={S.sm} />
      <Card flat style={{ paddingVertical: 0 }}>
        <Item title={t('deletion.webLink')} icon="doc" last onPress={() => void openPage()} />
      </Card>

      <Spacer h={S.lg} />
      <Field
        label={t('deletion.typeLabel')}
        value={typed}
        onChangeText={setTyped}
        placeholder={t('deletion.typePlaceholder')}
        icon="trash"
        autoCapitalize="characters"
      />
      <Btn title={t('deletion.title')} variant="danger" icon="trash" disabled={!ready} onPress={() => setConfirming(true)} />
      <Spacer h={S.lg} />

      <Confirm
        visible={confirming}
        onClose={() => (busy ? undefined : setConfirming(false))}
        title={t('deletion.confirmTitle')}
        body={t('deletion.confirmBody')}
        confirmLabel={t('deletion.confirmCta')}
        cancelLabel={t('common.cancel')}
        loading={busy}
        onConfirm={() => void remove()}
      />
    </Screen>
  );
}
