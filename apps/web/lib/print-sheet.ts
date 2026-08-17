/**
 * Hand a self-contained HTML document to the browser's print dialog.
 *
 * This was `window.open('', '_blank', 'noopener,...')` followed by writing the
 * document into the returned window. It opened a blank window and printed
 * nothing, every time, because of `noopener`: the spec says a window opened
 * with it returns **null**, precisely so the opener cannot reach into it. So
 * the popup appeared, the reference was null, and the report was written
 * nowhere. The empty window was the whole bug.
 *
 * A hidden iframe is better than fixing the flag. It cannot be blocked by a
 * popup blocker, it leaves no stray window behind if the student cancels the
 * dialog, and there is no reference to lose.
 */
export function printSheet(html: string, onFailure?: () => void): void {
  if (typeof document === 'undefined') return;

  const frame = document.createElement('iframe');
  // Off-screen rather than display:none. A frame with no box does not lay its
  // content out in every browser, and an unlaid-out document prints blank.
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);

  const cleanup = () => {
    // After the dialog closes, whether they printed or cancelled. Delayed
    // because removing the frame while the dialog is still up cancels the job
    // in Safari.
    window.setTimeout(() => frame.remove(), 1000);
  };

  try {
    const doc = frame.contentWindow?.document;
    if (!doc || !frame.contentWindow) {
      frame.remove();
      onFailure?.();
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    const run = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        onFailure?.();
      }
      cleanup();
    };

    // A tick to lay out before the dialog opens, or Safari prints a blank
    // first page. The load event does not always fire for a written document,
    // so the timeout is the actual trigger rather than a fallback.
    window.setTimeout(run, 250);
  } catch {
    frame.remove();
    onFailure?.();
  }
}
