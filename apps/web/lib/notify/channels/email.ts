import 'server-only';
import { SUPPORT_EMAIL, colors, translate } from '@matricmate/core';
import type { Language } from '@matricmate/core';
import type { ChannelAdapter, DeliveryResult } from '../types';
import { unsubscribeLink } from '@/lib/unsubscribe';
import { PLANS } from '@/lib/plans';

/**
 * Resend, for the messages a student may want to keep.
 *
 * Receipts, invoices, a report card worth reading on a bigger screen. Not
 * streak nudges: nobody opens email for those, and sending them there teaches
 * people to ignore the address we later need for a receipt. Which notices are
 * allowed here is decided per notice, in notify/notices.ts, not here.
 *
 * Free to 3,000 messages a month, which at this size is everything.
 *
 * Environment:
 *   RESEND_API_KEY   a send-only key is correct and is what we use
 *   EMAIL_FROM       "MatricMate <no-reply@matricmate.co>"
 *
 * The from-address must be on a domain verified in Resend, which means SPF,
 * DKIM and DMARC records. In Cloudflare each must be "DNS only" rather than
 * proxied, or authentication fails quietly and the mail lands in spam with no
 * error anywhere. matricmate.co is verified (a send from no-reply@ was
 * accepted, 15 Sep 2026), so this reaches real students.
 */

const apiKey = () => process.env.RESEND_API_KEY ?? '';
const from = () => process.env.EMAIL_FROM ?? '';
/** Domains no mailbox can exist on (RFC 2606 and 6761). */
const RESERVED_DOMAIN = /@(?:[^@\s]+\.)?(?:test|example|invalid|localhost)$|@example\.(?:com|net|org)$/i;

const esc = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** A body with blank lines between its paragraphs, as HTML paragraphs; single line breaks stay line breaks. */
const paragraphs = (body: string, color: string) =>
  body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p, i) => `<p style="margin:${i ? '12px' : '0'} 0 0;font-size:14.5px;color:${color}">${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');

/**
 * The plans on sale and their prices, one line each, in the student's
 * language. Email only: the app may never show a price (core/billing.ts).
 */
function planLines(lang: Language): { heading: string; lines: string[] } {
  const lines = PLANS.map((p) =>
    translate(lang, p.id === 'basic' ? 'email.planBasic' : 'email.planPremium', { price: p.price.toLocaleString('en-PK') }),
  );
  return { heading: translate(lang, 'email.plansHeading'), lines };
}

/**
 * The wrapper every message is posted in.
 *
 * Inline styles and no external font, image or stylesheet, for the same reason
 * the printed report card has none: a mail client will refuse to fetch them,
 * and Gmail strips a <style> block outright. Table-free and single-column, so
 * it survives Outlook without a layout table.
 */
function shell(
  lang: Language,
  heading: string,
  body: string,
  action?: { label: string; href: string },
  note?: string,
  stop?: string | null,
  plans?: { heading: string; lines: string[] },
): string {
  const rtl = lang === 'ur';
  const dir = rtl ? 'rtl' : 'ltr';
  const font = rtl
    ? "'Noto Nastaliq Urdu', serif"
    : "system-ui, -apple-system, 'Segoe UI', sans-serif";

  return `<!doctype html>
<html dir="${dir}" lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:${colors.paper};font-family:${font};direction:${dir};line-height:${rtl ? 2 : 1.6}">
  <div style="max-width:560px;margin:0 auto;background:${colors.card};border:1px solid ${colors.line};border-radius:16px;overflow:hidden">
    <div style="border-bottom:3px solid ${colors.teal};padding:18px 22px">
      <span style="font-size:19px;font-weight:800;color:${colors.teal}">MatricMate</span>
    </div>
    <div style="padding:22px">
      <h1 style="margin:0 0 10px;font-size:19px;color:${colors.ink}">${esc(heading)}</h1>
      ${paragraphs(body, colors.ink2)}
      ${
        plans
          ? `<div style="margin:18px 0 0;padding:14px 16px;background:${colors.paper};border:1px solid ${colors.line};border-radius:12px">
               <p style="margin:0 0 6px;font-size:13px;font-weight:800;color:${colors.ink}">${esc(plans.heading)}</p>
               ${plans.lines.map((l) => `<p style="margin:4px 0 0;font-size:14px;color:${colors.ink2}">${esc(l)}</p>`).join('')}
             </div>`
          : ''
      }
      ${
        action
          ? `<p style="margin:22px 0 0">
               <a href="${esc(action.href)}" style="display:inline-block;background:${colors.teal};color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;padding:11px 20px;border-radius:12px">${esc(action.label)}</a>
             </p>`
          : ''
      }
      ${note ? `<p style="margin:10px 0 0;font-size:12px;color:${colors.ink3}">${esc(note)}</p>` : ''}
    </div>
  </div>
  <p style="max-width:560px;margin:14px auto 0;font-size:11.5px;color:${colors.ink3};text-align:${rtl ? 'right' : 'left'}">
    ${esc(translate(lang, 'email.footer'))}${stop ? ` <a href="${esc(stop)}" style="color:${colors.ink3}">${esc(translate(lang, 'email.stopEmails'))}</a>` : ''}
  </p>
</body>
</html>`;
}

/**
 * A message to the team rather than a student: in English, to every address
 * on ADMIN_EMAILS, with a button into the admin pages. Not a notice, because
 * the team has no profile, preferences or language to read them from.
 */
export async function emailStaff(subject: string, body: string, action?: { label: string; href: string }): Promise<DeliveryResult> {
  if (!email.configured()) return 'unconfigured';
  const to = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e && !RESERVED_DOMAIN.test(e));
  if (!to.length) return 'skipped';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey()}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: from(),
        to,
        subject,
        html: shell('en', subject, body, action),
        text: `${subject}\n\n${body}\n${action ? `\n${action.label}: ${action.href}\n` : ''}`,
      }),
    });
    if (!res.ok) {
      console.error('notify/email: resend refused a staff email', res.status, (await res.text()).slice(0, 200));
      return 'failed';
    }
    return 'sent';
  } catch (e) {
    console.error('notify/email: staff email failed', e instanceof Error ? e.message : e);
    return 'failed';
  }
}

export const email: ChannelAdapter = {
  name: 'email',
  configured: () => Boolean(apiKey() && from()),

  send: async (to, notice) => {
    if (!email.configured()) return 'unconfigured';
    if (!to.prefs.channelEmail) return 'skipped';
    // Normally set, since sign-in is by email. It can still be absent on an
    // account created before that was true.
    if (!to.email) return 'skipped';
    // Test accounts live on reserved domains (probe-...@matricmate.test).
    // Mail to them can only bounce, and bounces cost the sender its standing
    // with every inbox a real student uses.
    if (RESERVED_DOMAIN.test(to.email)) return 'skipped';

    const subject = translate(to.lang, notice.title, notice.params);
    const body = translate(to.lang, notice.email?.body ?? notice.body, notice.params);
    const action = notice.email?.action ? { label: translate(to.lang, notice.email.action.label, notice.params), href: notice.email.action.href } : undefined;
    const note = notice.email?.note ? translate(to.lang, notice.email.note, notice.params) : undefined;
    const plans = notice.email?.plans ? planLines(to.lang) : undefined;

    const stop = unsubscribeLink(to.userId, to.lang);
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey()}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from: from(),
          to: [to.email],
          /*
           * Sent from no-reply@, but a student who hits Reply on a receipt or a
           * report card is asking a real question about their money or their
           * child, and no-reply@ is not read. Replies go to the support inbox.
           */
          reply_to: SUPPORT_EMAIL,
          subject,
          html: shell(to.lang, subject, body, action, note, stop, plans),
          // Mail apps show their own unsubscribe button for this, and a
          // press on it POSTs straight to the link (one-click, RFC 8058).
          ...(stop ? { headers: { 'List-Unsubscribe': `<${stop}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } } : {}),
          // A plain-text part as well, so a client that refuses HTML still
          // shows something, and so spam filters see a complete message.
          text: `${subject}\n\n${body}\n${plans ? `\n${plans.heading}\n${plans.lines.join('\n')}\n` : ''}${action ? `\n${action.label}: ${action.href}\n` : ''}${note ? `${note}\n` : ''}\n${translate(to.lang, 'email.footer')}\n${stop ? `${translate(to.lang, 'email.stopEmails')}: ${stop}\n` : ''}`,
        }),
      });
      if (!res.ok) {
        console.error('notify/email: resend refused', res.status, (await res.text()).slice(0, 200));
        return 'failed';
      }
      return 'sent';
    } catch (e) {
      console.error('notify/email: send failed', e instanceof Error ? e.message : e);
      return 'failed';
    }
  },
};
