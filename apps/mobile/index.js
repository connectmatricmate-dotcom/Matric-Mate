/**
 * The app's entry point, ahead of expo-router.
 *
 * This file exists for one reason: an error thrown while the app's modules are
 * still evaluating happens before React mounts, so there is no error boundary,
 * no red box, and nothing in the Metro log. The app opens and closes and tells
 * you nothing, which is the least debuggable failure there is.
 *
 * Everything here runs before the first application module, so a handler
 * registered now catches those. `require` rather than `import` on purpose:
 * import statements are hoisted to the top of the module and would run
 * expo-router before any of this.
 */

/**
 * The URL polyfill goes first, ahead of every other module.
 *
 * React Native's own URL is a string-concatenation stand-in whose properties
 * are getters with no setters, and libraries that assign to `url.protocol`
 * (Supabase does, building its realtime endpoint) throw on it. Doing this here
 * rather than only where Supabase is imported means anything else added later
 * gets a real URL too.
 */
require('react-native-url-polyfill/auto');

/**
 * Send startup errors to Metro, where they can actually be read.
 *
 * The previous handler still runs afterwards, so this only adds a log line and
 * changes nothing about how the app behaves.
 */
const errorUtils = global.ErrorUtils;
if (errorUtils && typeof errorUtils.setGlobalHandler === 'function') {
  const previous = errorUtils.getGlobalHandler && errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    console.error(
      `[startup] ${isFatal ? 'FATAL' : 'error'}: ${error && error.message ? error.message : String(error)}`
    );
    if (error && error.stack) console.error(error.stack);
    if (previous) previous(error, isFatal);
  });
}

require('expo-router/entry');
