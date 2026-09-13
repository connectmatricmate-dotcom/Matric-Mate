import 'server-only';
import { randomUUID } from 'node:crypto';
import { translate } from '@matricmate/core';
import { createAdminClient } from '@/lib/supabase/admin';
import { withRetry } from '../jobs';
import { storedTarget, type ChannelAdapter } from '../types';

/**
 * The in-app inbox: a row in public.notifications, which both apps read and
 * which the realtime trigger from 0020 delivers live.
 *
 * The only channel that is always available and can never be unsubscribed
 * from, which is why it is also the only one nothing checks a preference for.
 * If a student turns off push and email they still have a record in the app,
 * and we still have somewhere to put a payment receipt.
 *
 * Stored already translated rather than as a key, because the row outlives the
 * setting: a student who switches to English next month should still be able
 * to read the receipt they were sent in Urdu.
 */
export const inbox: ChannelAdapter = {
  name: 'inbox',
  configured: () => true,
  send: async (to, notice) => {
    const admin = createAdminClient();
    /*
     * The row's id is minted here so the insert can be retried. A gateway
     * timeout does not say whether the row landed; with its own id, a retry of
     * one that did collides on the primary key instead of putting the same
     * message in the inbox twice, and the collision means it is there.
     */
    const row = {
      id: randomUUID(),
      user_id: to.userId,
      kind: notice.kind,
      title: translate(to.lang, notice.title, notice.params),
      body: translate(to.lang, notice.body, notice.params),
      target: storedTarget(notice),
    };
    const { error } = await withRetry((signal) => admin.from('notifications').insert(row).abortSignal(signal));
    if (!error || error.code === '23505') return 'sent';
    console.error('notify/inbox: insert failed', error.message);
    return 'failed';
  },
};
