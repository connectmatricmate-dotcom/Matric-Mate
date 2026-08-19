'use client';

import { useState, useSyncExternalStore } from 'react';

/**
 * The teacher's link, and the two things they will actually do with it.
 *
 * Copy, because they are going to paste it into WhatsApp, which is how
 * everything in this market is shared. And the share sheet on a phone, which
 * skips the paste entirely. `navigator.share` does not exist on desktop
 * Chrome, so the button only appears where it works rather than failing in
 * front of them.
 */
const noSubscribe = () => () => {};
const hasShareSheet = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

export function ShareLink({ link, code, name }: { link: string; code: string; name: string }) {
  const [copied, setCopied] = useState(false);
  /* Whether the browser has a share sheet is a client-only fact, and the
     server has no `navigator` to ask. useSyncExternalStore is the way to read
     one without the server and client disagreeing about the first render:
     the server snapshot is false, the client's is the truth, and React swaps
     them without complaining about mismatched markup. It never changes during
     a session, so there is nothing to subscribe to. */
  const canShare = useSyncExternalStore(noSubscribe, hasShareSheet, () => false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // A browser that refuses the clipboard still shows the link above, and
      // selecting it by hand works. Nothing to say.
    }
  };

  const share = async () => {
    try {
      await navigator.share({
        title: 'MatricMate',
        text: `${name} has invited you to MatricMate: notes, past papers and an AI tutor for FBISE Class 9 and 10.`,
        url: link,
      });
    } catch {
      // Cancelled, which is not an error.
    }
  };

  return (
    <div className="rounded-[16px] border border-teal bg-tealtint px-4 py-4">
      <p className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-teal">Your link</p>
      <p className="mt-1 break-all font-mono text-[14px] text-ink">{link}</p>
      <p className="mt-2 text-[12.5px] text-ink2">
        Anyone who signs up through this is counted as yours, permanently. Your code is{' '}
        <span className="font-mono font-extrabold text-ink">{code}</span>.
      </p>
      <div className="mt-3.5 flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={copy}
          className="rounded-full bg-teal px-4 py-2.5 text-[13px] font-extrabold text-onbrand transition-[filter] duration-200 hover:brightness-110"
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
        {canShare ? (
          <button
            type="button"
            onClick={share}
            className="rounded-full border border-line bg-card px-4 py-2.5 text-[13px] font-extrabold text-ink transition-colors duration-200 hover:bg-paper"
          >
            Share
          </button>
        ) : null}
      </div>
    </div>
  );
}
