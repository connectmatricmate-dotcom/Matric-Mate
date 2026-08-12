/**
 * Whether this phone can currently reach the internet.
 *
 * A student on a bus, in a village with no data left, or in a load-shedding
 * blackout should still be able to open the app and study what they saved. The
 * session already survives offline, because Supabase keeps it in AsyncStorage,
 * so the only missing piece was knowing when to stop offering things that need
 * a server.
 *
 * WHY NOT useNetworkState()
 *
 * expo-network exposes a hook, and it was used here first. It sits at the root
 * of the tree, above every error boundary, so anything it throws takes the
 * whole app down before a screen renders rather than degrading. That is the
 * same failure the downloads helper had when it built a Directory at module
 * scope. Reading the state inside an effect means a module that is missing,
 * broken or unavailable on this platform costs us the offline shell and
 * nothing else: the app assumes it is online, which is what it did before any
 * of this existed.
 *
 * Reachability is the honest signal rather than "connected": a phone joined to
 * a router with no working uplink is connected and can fetch nothing.
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { setContentOnline } from '@matricmate/core';

const OnlineContext = createContext(true);

/**
 * How long the signal must stay down before the app changes shape.
 *
 * Going offline reroutes the student to the downloaded library, so a one second
 * dip in a lift should not do it. Coming back is applied immediately: there is
 * no cost to being online again.
 */
const SETTLE_MS = 3000;

/** How often to re-read, when the OS gives us no change events. */
const POLL_MS = 8000;

/**
 * Reads expo-network lazily and defensively.
 *
 * Returns null when the module cannot answer, which the caller treats as
 * online. require() rather than a static import so a missing native module is
 * a caught throw here instead of a failed module evaluation at startup.
 */
async function reachable(): Promise<boolean | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Network = require('expo-network');
    const state = await Network.getNetworkStateAsync();
    return state?.isInternetReachable ?? state?.isConnected ?? null;
  } catch {
    return null;
  }
}

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true);
  const offlineSince = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;

    async function check() {
      const up = await reachable();
      if (!alive) return;

      // Unknown counts as online. Better a request that fails than an app that
      // hides itself because one module would not answer.
      if (up !== false) {
        offlineSince.current = null;
        setOnline(true);
        return;
      }

      const since = offlineSince.current ?? Date.now();
      offlineSince.current = since;
      if (Date.now() - since >= SETTLE_MS) setOnline(false);
    }

    void check();
    const timer = setInterval(check, POLL_MS);
    // Coming back to the app is the moment the answer matters most, and the
    // one time a student will not wait out the poll interval.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void check();
    });

    return () => {
      alive = false;
      clearInterval(timer);
      sub.remove();
    };
  }, []);

  // Tell the content layer, so a fetch that cannot succeed is skipped rather
  // than timed out. This is why airplane mode opens a downloaded chapter
  // instantly instead of after a spinner.
  useEffect(() => {
    setContentOnline(online);
  }, [online]);

  return <OnlineContext.Provider value={online}>{children}</OnlineContext.Provider>;
}

/** True when the app can reach the server. Defaults to true, see the note above. */
export const useOnline = (): boolean => useContext(OnlineContext);
