/**
 * Where this tab has been inside the site, so a back button can go back.
 *
 * Back links used to be plain links to a fixed page. The MCQ setup said
 * "Practice" wherever it was opened from, finishing a set sent everyone to
 * /practice, and every one of those links added a history entry, so the
 * browser's own back button then walked into the set the student had just
 * finished. The Android app has a real stack and never had the problem.
 *
 * Next.js does not say where a tab is in its history, so every entry the site
 * creates is numbered as it is made: pushState moves one on, replaceState keeps
 * the place, and going back or forward reads the number off the entry. With
 * that a back link knows two things: whether there is a page of ours behind
 * this one at all (a tab opened on a link from WhatsApp has none, and going
 * "back" there would leave the site), and which page it was. The numbers live
 * on the history entries themselves and the trail in sessionStorage, so both
 * survive a reload.
 */

const KEY = 'mm.trail';
let idx = 0;
let trail: string[] = [];
let installed = false;
const listeners = new Set<() => void>();

const here = () => window.location.pathname + window.location.search;
const toPath = (url?: string | URL | null) => {
  if (url == null) return here();
  const u = new URL(String(url), window.location.href);
  return u.pathname + u.search;
};
const save = () => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(trail.slice(0, idx + 1)));
  } catch {
    // Private windows can refuse storage; the trail still works until reload.
  }
  listeners.forEach((l) => l());
};

function install() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const h = window.history;
  try {
    trail = JSON.parse(sessionStorage.getItem(KEY) ?? '[]');
  } catch {
    trail = [];
  }
  idx = typeof h.state?.mmIdx === 'number' ? h.state.mmIdx : 0;
  trail = trail.slice(0, idx);
  trail[idx] = here();
  const push = h.pushState.bind(h);
  const replace = h.replaceState.bind(h);
  h.pushState = function pushState(data: unknown, unused: string, url?: string | URL | null) {
    idx += 1;
    trail = trail.slice(0, idx);
    trail[idx] = toPath(url);
    save();
    return push({ ...((data as object) ?? {}), mmIdx: idx }, unused, url);
  };
  h.replaceState = function replaceState(data: unknown, unused: string, url?: string | URL | null) {
    trail[idx] = toPath(url);
    save();
    return replace({ ...((data as object) ?? {}), mmIdx: idx }, unused, url);
  };
  window.addEventListener('popstate', (e) => {
    const i = (e.state as { mmIdx?: unknown } | null)?.mmIdx;
    idx = typeof i === 'number' ? i : 0;
    trail[idx] = here();
    save();
  });
  replace({ ...(h.state ?? {}), mmIdx: idx }, '');
  save();
}

install();

/** Whether a page of this site is behind the current one in this tab. */
export function canGoBack(): boolean {
  install();
  return idx > 0;
}

/** The page behind this one ("/learn/chapter/phy-3"), or null. */
export function previousPath(): string | null {
  install();
  return idx > 0 ? (trail[idx - 1] ?? null) : null;
}

export function subscribeTrail(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/**
 * Back to an earlier page of this tab's history, however many steps behind,
 * the way the Android app's dismissTo works: "Save" on a profile editor used
 * to push the profile again, leaving the editor behind it for back to find.
 * With the page nowhere behind (opened from a link), it replaces this one.
 */
export function goBackTo(router: { replace(href: string): void }, path: string): void {
  install();
  for (let i = idx - 1; i >= 0; i -= 1) {
    if ((trail[i] ?? '').split('?')[0] === path) {
      window.history.go(i - idx);
      return;
    }
  }
  router.replace(path);
}
