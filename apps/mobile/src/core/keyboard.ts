import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * How much of the bottom of the window the keyboard is covering. Zero when it
 * is down. Pad a full-height container by exactly this and its content ends at
 * the top of the keys.
 *
 * The arithmetic is the whole point, and getting it wrong by one term is what
 * left the chat composer half behind the keyboard on the first attempt.
 *
 * React Native reports the Android keyboard as `imeInsets.bottom -
 * systemBars.bottom` (ReactRootView.checkForKeyboardEvents): the keys, with the
 * navigation bar taken off. react-native-safe-area-context deliberately leaves
 * the IME out of its own insets (SafeAreaUtils.kt asks for statusBars,
 * displayCutout, navigationBars and captionBar, and the older code path says in
 * as many words that the keyboard is not wanted there). So `insets.bottom` is
 * the navigation bar and nothing else, whether or not the keyboard is up, and
 * the two add back up to the real overlap. Padding by the keyboard alone left
 * content sitting a navigation bar too low.
 *
 * iOS measures its keyboard from the bottom of the screen already, home
 * indicator included, so there is nothing to add there.
 *
 * Android has no `will` events, only `did`. Subscribing to both pairs would
 * double-fire on iOS, so each platform gets the earliest pair it has.
 */
export function useKeyboardOverlap(): number {
  const insets = useSafeAreaInsets();
  const [raw, setRaw] = useState(0);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) =>
      setRaw(e.endCoordinates?.height ?? 0),
    );
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setRaw(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (raw <= 0) return 0;
  return Platform.OS === 'ios' ? raw : raw + insets.bottom;
}
