import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { formatDate, isUrduScript } from '@matricmate/core';
import {
  Btn,
  Card,
  Confirm,
  Empty,
  ErrorState,
  Field,
  Header,
  Item,
  Screen,
  Sheet,
  Skeleton,
  Small,
  Spacer,
  Tap,
  Text,
  TextInput,
  useToast,
} from '../../src/components/ui';
import { Icon } from '../../src/components/Icon';
import { supabase } from '../../src/lib/supabase';
import { useAsync } from '../../src/core/useAsync';
import { useLang, useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, R, S, isWeb, rowDir, textStart, urdu } from '../../src/theme';

/**
 * Every conversation the student has ever had with the tutor.
 *
 * The tutor tab shows the six most recent, which is right for a tab: it is a
 * launchpad, not an archive. But a chat older than six was unreachable, and
 * these are not disposable. A student works through a hard chapter with the
 * tutor in September and wants it back in March, the week before the paper.
 *
 * Read straight from Postgres under the student's own row-level security, so
 * a conversation started on the website is here too, and one started here is
 * on the website.
 */

type ThreadRow = { id: string; title: string; context_label: string | null; updated_at: string };

/** Paged, because `select()` stops at a thousand rows without saying so, and a
 *  student who uses the tutor daily for two years will pass that. */
const PAGE = 100;

export default function AllChats() {
  const { state } = useApp();
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const [query, setQuery] = useState('');
  /**
   * Renaming and deleting a chat. A shared family phone is the reason: a
   * conversation is the student's own, and there was no way to tidy or remove
   * one. Straight to the table under the student's own row-level security,
   * which lets an account change and delete its own threads; the messages go
   * with a deleted thread.
   */
  const [editing, setEditing] = useState<ThreadRow | null>(null);
  const [title, setTitle] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  async function rename() {
    if (!editing || !title.trim() || saving) return;
    setSaving(true);
    const { error } = await supabase.from('chat_threads').update({ title: title.trim() }).eq('id', editing.id);
    setSaving(false);
    if (error) {
      toast(t('states.errorBody'));
      return;
    }
    setEditing(null);
    toast(t('tutor.chatRenamed'));
    threads.reload();
  }

  async function remove() {
    if (!editing || saving) return;
    setSaving(true);
    const { error } = await supabase.from('chat_threads').delete().eq('id', editing.id);
    setSaving(false);
    setConfirmDelete(false);
    if (error) {
      toast(t('states.errorBody'));
      return;
    }
    setEditing(null);
    toast(t('tutor.chatDeleted'));
    threads.reload();
  }

  const threads = useAsync<ThreadRow[]>(async () => {
    const all: ThreadRow[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('chat_threads')
        .select('id,title,context_label,updated_at')
        .order('updated_at', { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      const page = (data as ThreadRow[]) ?? [];
      all.push(...page);
      if (page.length < PAGE) break;
    }
    return all;
  }, [state.user?.id ?? '']);

  const hits = useMemo(() => {
    const rows = threads.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.title.toLowerCase().includes(q) || (r.context_label ?? '').toLowerCase().includes(q),
    );
  }, [threads.data, query]);

  return (
    <Screen>
      <Header title={t('tutor.allChatsTitle')} sub={t('tutor.allChatsSub')} back />

      {threads.data && threads.data.length > 6 ? (
        <View
          style={{
            flexDirection: rowDir(),
            alignItems: 'center',
            gap: S.sm,
            backgroundColor: C.card,
            borderWidth: 1.5,
            borderColor: C.line,
            borderRadius: R.pill,
            paddingHorizontal: 14,
            paddingVertical: 10,
            marginBottom: S.md,
          }}
        >
          <Icon name="search" size={17} color={C.ink3} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('tutor.searchChats')}
            placeholderTextColor={C.ink3}
            style={[
              { flex: 1, fontFamily: F.body, fontSize: 14, color: C.ink, paddingVertical: 0, textAlign: textStart() },
              isUrduScript(query) ? { ...urdu(14), paddingVertical: 0 } : null,
              isWeb && ({ outlineStyle: 'none' } as object),
            ]}
          />
          {query ? (
            <Tap onPress={() => setQuery('')}>
              <Icon name="close" size={16} color={C.ink3} />
            </Tap>
          ) : null}
        </View>
      ) : null}

      {threads.loading ? (
        <>
          <Skeleton h={64} />
          <Spacer h={S.sm} />
          <Skeleton h={64} />
          <Spacer h={S.sm} />
          <Skeleton h={64} />
        </>
      ) : threads.error ? (
        <ErrorState
          title={t('states.errorTitle')}
          sub={t('states.errorBody')}
          retry={t('common.retry')}
          onRetry={threads.reload}
        />
      ) : !hits.length ? (
        <Empty
          emoji="💬"
          title={query ? t('tutor.noChatMatch') : t('tutor.noChatsTitle')}
          sub={query ? '' : t('tutor.noChatsBody')}
        />
      ) : (
        <Card flat style={{ paddingVertical: 0 }}>
          {hits.map((thread, i) => (
            <Item
              key={thread.id}
              title={thread.title}
              // A middot between the two, as on the website: run together they
              // read as one phrase, "Physics 12 Sept".
              sub={[thread.context_label, formatDate(thread.updated_at, lang, { day: 'numeric', month: 'short' })].filter(Boolean).join(' · ')}
              icon="spark"
              last={i === hits.length - 1}
              onPress={() => router.push(`/tutor/chat?thread=${thread.id}`)}
              right={
                <Tap
                  onPress={() => {
                    setEditing(thread);
                    setTitle(thread.title);
                  }}
                  hit
                >
                  <Icon name="dots" size={18} color={C.ink3} />
                </Tap>
              }
            />
          ))}
        </Card>
      )}

      <Spacer h={S.lg} />
      <Text style={{ textAlign: 'center' }}>
        <Small>{t('tutor.disclaimer')}</Small>
      </Text>

      <Sheet visible={!!editing && !confirmDelete} onClose={() => setEditing(null)} title={t('tutor.renameChat')}>
        <Field label={t('tutor.chatName')} value={title} onChangeText={setTitle} autoCapitalize="words" />
        <Btn title={t('common.save')} onPress={() => void rename()} loading={saving} disabled={!title.trim()} />
        <Spacer h={S.sm} />
        <Btn title={t('tutor.deleteChat')} variant="ghost" icon="trash" onPress={() => setConfirmDelete(true)} disabled={saving} />
      </Sheet>

      <Confirm
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('tutor.deleteChat')}
        body={t('tutor.deleteChatBody')}
        confirmLabel={t('tutor.deleteChat')}
        cancelLabel={t('common.cancel')}
        loading={saving}
        onConfirm={() => void remove()}
      />
    </Screen>
  );
}
