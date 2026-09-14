'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/primitives';

/**
 * A copy button for a teacher's referral link, for the admin's tables.
 *
 * Adnan hands these links out himself, over WhatsApp, and selecting a URL out
 * of a table row on a phone is fiddly. One press copies the whole link, the
 * label says it worked, and where the browser refuses the clipboard (an in-app
 * browser, plain http) it says so, since the link is on screen to select.
 */
export function CopyLink({ link }: { link: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setState('copied');
      setTimeout(() => setState('idle'), 2200);
    } catch {
      setState('failed');
    }
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={`Copy ${link}`}
        className="inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-teal bg-card px-3 text-[12.5px] font-extrabold text-teal transition-colors duration-200 hover:bg-tealtint md:h-10"
      >
        <Icon name={state === 'copied' ? 'check' : 'doc'} size={14} strokeWidth={2.4} />
        {state === 'copied' ? 'Copied' : 'Copy link'}
      </button>
      {state === 'failed' ? (
        <span role="alert" className="text-[11.5px] font-extrabold text-red">
          Could not copy. Select the link and copy it.
        </span>
      ) : null}
    </span>
  );
}
