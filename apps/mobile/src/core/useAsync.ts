import { useCallback, useEffect, useState } from 'react';

/**
 * Tiny data hook so every screen gets real loading and error states from the
 * mock API. Swapping in Supabase later needs no change here.
 *
 * Two things about the shape, both prompted by the hook lint rules and both
 * improvements on what was here before.
 *
 * **The deps are flattened to a string.** A dependency array handed in by a
 * caller is invisible to those rules, which can only reason about a literal
 * written at the call site. Every caller passes scalars (a chapter id, a
 * subject id, a joined list), so one joined key is a faithful stand-in and one
 * the rules can actually check.
 *
 * **`loading` is derived, not stored.** The old version set it at the top of
 * the fetch, which is a state write on the way into an effect and the reason a
 * single fetch cost two renders. Comparing the key that settled against the key
 * being asked for now gives the same answer for free. Previous data stays on
 * screen while the next request is in flight, so a changing id does not blank
 * the page mid-navigation.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  /** Bumped by reload(), so a retry refetches without any dep changing. */
  const [attempt, setAttempt] = useState(0);
  // JSON rather than join, so ['a b','c'] and ['a','b c'] stay distinct and a
  // null dep cannot masquerade as the string "null".
  const key = JSON.stringify([attempt, ...deps]);

  const [settled, setSettled] = useState<{ key: string; data: T | null; error: string | null } | null>(null);

  useEffect(() => {
    let alive = true;
    fn()
      .then((d) => alive && setSettled({ key, data: d, error: null }))
      .catch(
        (e) =>
          alive && setSettled({ key, data: null, error: e instanceof Error ? e.message : 'Something went wrong.' })
      );
    return () => {
      alive = false;
    };
    // `fn` is a fresh closure on every render by design, so listing it would
    // refetch forever. `key` is what actually changes the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loading = settled?.key !== key;
  return {
    data: settled?.data ?? null,
    loading,
    // A stale error must not outlive the request that produced it.
    error: loading ? null : (settled?.error ?? null),
    reload: useCallback(() => setAttempt((n) => n + 1), []),
  };
}
