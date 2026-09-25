import { useEffect } from 'react';
import { Dimensions, Platform } from 'react-native';

type Orientation = typeof import('expo-screen-orientation');

/**
 * The module, or null on a build that does not have it.
 *
 * It is native, so it exists only from 0.6.1. Required inside a try rather
 * than imported: an update that reached an older build would otherwise throw
 * "Cannot find native module" while loading this file, and take the whole app
 * down with it on launch. Without it the build simply keeps its manifest lock.
 */
const ScreenOrientation: Orientation | null = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-screen-orientation') as Orientation;
  } catch {
    return null;
  }
})();

/**
 * Portrait on phones, free on anything bigger.
 *
 * The app used to be locked to portrait in the manifest. From Android 16 that
 * lock is ignored on any display 600dp or wider (tablets, foldables, desktop
 * windows), so the lock bought nothing there and Play warned about it in
 * review. The screens are designed for one column, though, and a phone turned
 * sideways is nobody's idea of studying, so the lock moved here, where it can
 * ask how big the screen actually is.
 *
 * Re-checked on every size change, because a foldable is a phone shut and a
 * small tablet open, and the answer has to change with it.
 */
const PHONE_BELOW = 600;

export function usePortraitOnPhones() {
  useEffect(() => {
    if (Platform.OS === 'web' || !ScreenOrientation) return;
    const orientation = ScreenOrientation;
    let live = true;
    const apply = () => {
      const { width, height } = Dimensions.get('screen');
      const phone = Math.min(width, height) < PHONE_BELOW;
      const request = phone ? orientation.lockAsync(orientation.OrientationLock.PORTRAIT_UP) : orientation.unlockAsync();
      // A device that refuses to be told is not a reason to fail startup.
      request.catch(() => {});
    };
    apply();
    const sub = Dimensions.addEventListener('change', () => {
      if (live) apply();
    });
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
}
