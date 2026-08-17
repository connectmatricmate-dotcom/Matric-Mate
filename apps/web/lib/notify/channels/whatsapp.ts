import 'server-only';
import type { ChannelAdapter } from '../types';

/**
 * WhatsApp, for the two messages where reaching the student protects revenue:
 * a renewal reminder and a payment confirmation. Nothing routine.
 *
 * Reserved for those because it is the only channel here that costs real money
 * per message (roughly Rs 3 to 4.50 for a service message, more after Meta's
 * October 2026 pricing change) and the only one with a hard consent rule.
 *
 * Three gates before a single message may be sent, all enforced here and in
 * the dispatcher rather than trusted to the caller:
 *   · the student gave us a number
 *   · the student explicitly opted in, recorded with a timestamp on
 *     profiles.whatsapp_opt_in as the evidence
 *   · the wording matches a template Meta approved in advance, which is why
 *     this channel sends a template name and variables, not a sentence
 *
 * Two routes, decided in docs/NOTIFICATIONS.md: SendPK resells both SMS and
 * WhatsApp under one Pakistani account, or Meta directly at their own rate.
 * Meta bills in USD and takes only Visa or Mastercard, so if the client's card
 * will not work internationally the choice is made for us.
 *
 * Blocked on paperwork, not on code: Meta business verification needs the
 * domain live, plus a phone number that has never been used on ordinary
 * WhatsApp and cannot be reused afterwards.
 */

const token = () => process.env.WHATSAPP_TOKEN ?? '';
const phoneNumberId = () => process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';

export const whatsapp: ChannelAdapter = {
  name: 'whatsapp',
  configured: () => Boolean(token() && phoneNumberId()),

  send: async (to, notice) => {
    if (!whatsapp.configured()) return 'unconfigured';
    if (!to.prefs.channelWhatsapp) return 'skipped';
    if (!to.phone) return 'skipped';
    // No timestamp, no consent, no message. This is the one check that is not
    // a preference but a legal condition, so it is not merged with the others.
    if (!to.whatsappOptIn) return 'skipped';

    void notice;
    /*
     * Not implemented rather than faked. When the account exists this posts a
     * template message to graph.facebook.com/v21.0/<phoneNumberId>/messages,
     * naming an approved template and its variables. It will not accept the
     * free-text title and body the other channels use, so each notice that is
     * allowed here needs a matching approved template first.
     */
    return 'unconfigured';
  },
};
