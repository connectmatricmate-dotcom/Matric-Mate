import 'server-only';
import { colors, translate } from '@matricmate/core';
import type { Language } from '@matricmate/core';
import type { ChannelAdapter } from '../types';

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
 * error anywhere. Until that is done the test sender only reaches the Resend
 * account owner, so this channel is effectively off for real students.
 */

const apiKey = () => process.env.RESEND_API_KEY ?? '';
const from = () => process.env.EMAIL_FROM ?? '';

const esc = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/**
 * The wrapper every message is posted in.
 *
 * Inline styles and no external font, image or stylesheet, for the same reason
 * the printed report card has none: a mail client will refuse to fetch them,
 * and Gmail strips a <style> block outright. Table-free and single-column, so
 * it survives Outlook without a layout table.
 */
function shell(lang: Language, heading: string, body: string, action?: { label: string; href: string }): string {
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
      <p style="margin:0;font-size:14.5px;color:${colors.ink2}">${esc(body)}</p>
      ${
        action
          ? `<p style="margin:22px 0 0">
               <a href="${esc(action.href)}" style="display:inline-block;background:${colors.teal};color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;padding:11px 20px;border-radius:12px">${esc(action.label)}</a>
             </p>`
          : ''
      }
    </div>
  </div>
  <p style="max-width:560px;margin:14px auto 0;font-size:11.5px;color:${colors.ink3};text-align:${rtl ? 'right' : 'left'}">
    ${esc(translate(lang, 'email.footer'))}
  </p>
</body>
</html>`;
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

    const subject = translate(to.lang, notice.title, notice.params);
    const body = translate(to.lang, notice.body, notice.params);

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey()}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from: from(),
          to: [to.email],
          subject,
          html: shell(to.lang, subject, body),
          // A plain-text part as well, so a client that refuses HTML still
          // shows something, and so spam filters see a complete message.
          text: `${subject}\n\n${body}\n`,
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
