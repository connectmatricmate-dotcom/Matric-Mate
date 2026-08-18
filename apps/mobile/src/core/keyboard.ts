import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * How much of the screen the keyboard is covering, above the safe-area inset
 * the layout already reserves. Zero when it is down.
 *
 * Why this is hand-rolled rather than `KeyboardAvoidingView`: that component
 * does nothing on Android unless you give it a `behavior`, and the app passed
 * `undefined` there, so on the one platform we actually ship, the four screens
 * that opted in were no better off than the ones that did not. Every input in
 * the app sat under the keyboard.
 *
 * The numbers can be trusted. React Native 0.86 reads the Android keyboard
 * from `WindowInsetsCompat.Type.ime()` and reports its height with the system
 * bars already subtracted (see ReactRootView.checkForKeyboardEvents), which is
 * exactly the extra padding a layout that already reserves `insets.bottom`
 * needs. iOS measures from the bottom of the screen instead, so the home
 * indicator has to come off there.
 *
 * Android has no `will` events, only `did`. Subscribing to both pairs would
 * double-fire on iOS, so each platform gets the earliest pair it has: iOS can
 * animate with the keyboard, Android learns a frame later.
 */
export function useKeyboardHeight(): number {
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
  return Platform.OS === 'ios' ? Math.max(0, raw - insets.bottom) : raw;
}
