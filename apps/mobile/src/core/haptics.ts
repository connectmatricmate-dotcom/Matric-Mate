/**
 * One tap, one tick. The physical half of every celebration.
 *
 * Wrapped so a device without a vibrator, or a future platform without the
 * module, costs us the buzz and never the moment: every call is fire-and-
 * forget and swallows its own failure. Nothing in the app may await these.
 */
import * as Haptics from 'expo-haptics';

/** A light tick for a correct answer or a selection. */
export function tick(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** A firmer thud for a wrong answer. */
export function thud(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

/** The double-buzz of something worth celebrating. */
export function cheer(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
