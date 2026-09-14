'use client';

import type { PlanId } from '@/lib/plans';

export type CheckoutStart =
  | { ok: true }
  | { ok: false; status: number; error?: string; validTill?: string | null };

/**
 * Start paying for a plan: ask the server for a checkout, then go to it.
 *
 * One copy of this for every buy button. The gateways answer differently:
 * Safepay with a URL to follow, PayFast with a form to POST. The upgrade button
 * only knew the first, so with PayFast switched on every "Get Premium" outside
 * the checkout page failed with "could not start". Only the checkout form had
 * the form path. Resolves only when it could not leave the page; on success
 * the browser is already on its way to the gateway.
 */
export async function startCheckout(plan: PlanId): Promise<CheckoutStart> {
  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    url?: string;
    form?: { action: string; fields: Record<string, string> };
    error?: string;
    validTill?: string | null;
  };
  if (!res.ok || (!body.url && !body.form)) return { ok: false, status: res.status, error: body.error, validTill: body.validTill };

  if (body.form) {
    // Built off-DOM and submitted at once; the student never sees it.
    const f = document.createElement('form');
    f.method = 'POST';
    f.action = body.form.action;
    for (const [name, value] of Object.entries(body.form.fields)) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      f.appendChild(input);
    }
    document.body.appendChild(f);
    f.submit();
    return { ok: true };
  }
  window.location.href = body.url as string;
  return { ok: true };
}
