import { router, type Href } from 'expo-router';

/**
 * Start history again from one screen, where the account changes: signed in,
 * signed up, onboarding finished, signed out.
 *
 * Replacing only the top screen kept whatever was underneath it. Signing in
 * from the welcome carousel left the carousel under the app, so Android back
 * on Home opened "Everything in one app" to a signed-in student; signing out
 * left the app under the login form, one back press from a signed-out Home.
 */
export function resetTo(href: Href) {
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
}

/**
 * The end of a flashcard, blank or short-question set: back to wherever it was
 * opened. The chapter hub opens them with `from=chapter`, and only then does
 * the button say "Back to chapter". From the Practice tab, the plan on Home or
 * an AI set it says "Done", where it used to open a chapter the student had
 * never been on. Opened from a link with nothing underneath, the chapter or
 * the Practice tab.
 */
export function leaveSet(fromChapter: boolean, chapterId: string | null) {
  if (router.canGoBack()) router.back();
  else router.replace(fromChapter && chapterId ? `/learn/chapter/${chapterId}` : '/(tabs)/practice');
}
