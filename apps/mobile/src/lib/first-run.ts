import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Whether this device has ever been past the welcome carousel.
 *
 * The three slides are a first-run introduction: what the app is, what it
 * costs you to try. Signing out used to land back on them, so a student who
 * had used the app for a month and tapped "log out" was pitched the product
 * again and had to swipe through it to reach a login form. Signing out is not
 * a first run.
 *
 * Kept out of the app store on purpose. That store is wiped on sign-out and on
 * "reset app data", and this needs to survive both: the same person on the
 * same phone has still seen the slides. It does NOT survive clearing the app's
 * storage from Android settings, which is correct, because that is the
 * device's way of saying "pretend this was never installed".
 */
const KEY = 'mm.seenWelcome';

export async function hasSeenWelcome(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    // Unreadable storage should show the slides, not hide the app behind an
    // error: the worst case is one extra swipe.
    return false;
  }
}

export function markWelcomeSeen(): void {
  AsyncStorage.setItem(KEY, '1').catch(() => {});
}
