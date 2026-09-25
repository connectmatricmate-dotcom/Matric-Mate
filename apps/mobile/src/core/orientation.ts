import { useEffect } from 'react';
import { Dimensions, Platform } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

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
    if (Platform.OS === 'web') return;
    let live = true;
    const apply = () => {
      const { width, height } = Dimensions.get('screen');
      const phone = Math.min(width, height) < PHONE_BELOW;
      const request = phone
        ? ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
        : ScreenOrientation.unlockAsync();
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
