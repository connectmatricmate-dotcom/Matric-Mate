import { NextRequest, NextResponse } from 'next/server';
import { translate, type Language } from '@matricmate/core';
import { readUnsubscribe } from '@/lib/unsubscribe';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * One tap from an email to no more emails (lib/unsubscribe.ts). GET is the
 * link in the footer; POST is the one-click unsubscribe mail apps send when
 * the reader presses their own button (RFC 8058). Both switch the account's
 * email channel off, the same switch as Profile > Notifications > Email, and
 * nothing else: the inbox in the app and push notifications carry on.
 */
async function switchOff(req: NextRequest): Promise<'done' | 'bad' | 'failed'> {
  const userId = readUnsubscribe(req.nextUrl.searchParams);
  if (!userId) return 'bad';
  const admin = createAdminClient();
  const { data, error } = await admin.from('profiles').select('settings').eq('id', userId).maybeSingle();
  if (error) return 'failed';
  if (!data) return 'done';
  const settings = { ...((data.settings ?? {}) as Record<string, unknown>), channelEmail: false };
  const { error: we } = await admin.from('profiles').update({ settings }).eq('id', userId);
  return we ? 'failed' : 'done';
}

const page = (lang: Language, title: string, body: string, status = 200) =>
  new NextResponse(
    `<!doctype html><html lang="${lang}" dir="${lang === 'ur' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · MatricMate</title><meta name="robots" content="noindex"></head>` +
      `<body style="margin:0;background:#f7f5f0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1d2433">` +
      `<main style="max-width:480px;margin:12vh auto;padding:28px 24px;background:#fff;border-radius:18px;box-shadow:0 1px 3px rgba(0,0,0,.08)">` +
      `<h1 style="margin:0 0 10px;font-size:22px">${title}</h1><p style="margin:0;font-size:15px;line-height:1.7">${body}</p>` +
      `<p style="margin:22px 0 0"><a href="/" style="color:#0a7ea4;font-weight:700;text-decoration:none">MatricMate</a></p></main></body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  );

export async function GET(req: NextRequest) {
  const lang: Language = req.nextUrl.searchParams.get('l') === 'ur' ? 'ur' : 'en';
  const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);
  const result = await switchOff(req);
  if (result === 'bad') return page(lang, t('email.unsubBadTitle'), t('email.unsubBadBody'), 400);
  if (result === 'failed') return page(lang, t('email.unsubRetryTitle'), t('email.unsubRetryBody'), 503);
  return page(lang, t('email.unsubDoneTitle'), t('email.unsubDoneBody'));
}

export async function POST(req: NextRequest) {
  const result = await switchOff(req);
  return NextResponse.json({ ok: result === 'done' }, { status: result === 'done' ? 200 : result === 'bad' ? 400 : 503 });
}
