/**
 * Whether this phone can currently reach the internet.
 *
 * A student on a bus, in a village with no data left, or in a load-shedding
 * blackout should still be able to open the app and study what they saved. The
 * session already survives offline, because Supabase keeps it in AsyncStorage,
 * so the only missing piece was knowing when to stop offering things that need
 * a server.
 *
 * `isInternetReachable` is the honest signal rather than `isConnected`: a phone
 * joined to a wifi router with no working uplink is "connected" and can fetch
 * nothing. It is undefined for a moment at launch while the probe runs, and we
 * assume online then, because flashing the offline library at every cold start
 * would be worse than a request that fails once.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useNetworkState } from 'expo-network';

const OnlineContext = createContext(true);

/**
 * How long the signal must stay down before the app changes shape.
 *
 * Going offline reroutes the student to the downloaded library, so a one second
 * dip in a lift should not do it. Coming back is applied immediately: there is
 * no cost to being online again.
 */
const SETTLE_MS = 3000;

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const net = useNetworkState();
  const reachable = net.isInternetReachable ?? net.isConnected ?? true;
  const [settledOffline, setSettledOffline] = useState(false);
  const [seen, setSeen] = useState(reachable);

  // Adjusted during render rather than in an effect, so the settle timer starts
  // fresh on each new outage instead of the second drop being instant.
  if (seen !== reachable) {
    setSeen(reachable);
    if (reachable) setSettledOffline(false);
  }

  useEffect(() => {
    if (reachable) return;
    const timer = setTimeout(() => setSettledOffline(true), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [reachable]);

  const online = reachable || !settledOffline;
  return <OnlineContext.Provider value={online}>{children}</OnlineContext.Provider>;
}

/** True when the app can reach the server. Default true, see the note above. */
export const useOnline = (): boolean => useContext(OnlineContext);
