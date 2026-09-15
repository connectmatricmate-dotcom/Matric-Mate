'use client';

import { switchAccountAction } from '@/app/(auth)/actions';
import { SubmitButton } from '@/components/ui/controls';
import { releaseWebPush } from '@/lib/web-push';

/**
 * "Switch account": sign out and come back to `next` as someone else.
 *
 * The browser's notifications are handed back first, while the session can
 * still prove whose they are, the same as the Log out button does. Signing
 * out straight from the server action left this browser registered to the
 * account that had just left it, so its notices kept arriving here.
 */
export function SwitchAccountForm({ next, title, pendingTitle }: { next: string; title: string; pendingTitle: string }) {
  return (
    <form
      action={async (data: FormData) => {
        await releaseWebPush();
        await switchAccountAction(data);
      }}
      className="mt-5"
    >
      <input type="hidden" name="next" value={next} />
      <SubmitButton title={title} pendingTitle={pendingTitle} className="w-full" />
    </form>
  );
}
