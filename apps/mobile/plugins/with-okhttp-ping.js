/**
 * A keep-alive ping on React Native's HTTP client, so a dead connection is
 * noticed in seconds instead of minutes.
 *
 * React Native builds its OkHttp client with no timeouts and no ping. After
 * the phone's network changes (airplane mode off, Wi-Fi to mobile data), the
 * HTTP/2 connection to the database can be left pointing at nothing, and
 * every request after that is sent down it and waits: on the test phone, for
 * about four minutes, during which nothing loaded and nothing synced. With a
 * ping every ten seconds OkHttp sees the connection is gone, drops it and
 * opens a new one.
 *
 * Native code, so it takes effect with the next build (an OTA cannot change
 * it). Until then the app's own request limit and retries cover it
 * (src/lib/supabase.ts, the reconnect retry in src/store/app.tsx).
 */
const { withMainApplication } = require('expo/config-plugins');

const IMPORTS = [
  'import com.facebook.react.modules.network.OkHttpClientFactory',
  'import com.facebook.react.modules.network.OkHttpClientProvider',
  'import java.util.concurrent.TimeUnit',
];

const FACTORY = `
    // plugins/with-okhttp-ping.js: notice a dead connection after a network change.
    OkHttpClientProvider.setOkHttpClientFactory(object : OkHttpClientFactory {
      override fun createNewNetworkModuleClient() =
        OkHttpClientProvider.createClientBuilder(this@MainApplication).pingInterval(10, TimeUnit.SECONDS).build()
    })
`;

module.exports = function withOkHttpPing(config) {
  return withMainApplication(config, (mod) => {
    let src = mod.modResults.contents;
    if (mod.modResults.language !== 'kt') {
      throw new Error('with-okhttp-ping: expected a Kotlin MainApplication');
    }
    if (!src.includes('OkHttpClientProvider.setOkHttpClientFactory')) {
      for (const line of IMPORTS) {
        if (!src.includes(line)) src = src.replace(/^(package [^\n]+\n)/m, `$1\n${line}`);
      }
      // Straight after super.onCreate(), before React Native starts.
      src = src.replace(/(override fun onCreate\(\)\s*\{\s*\n\s*super\.onCreate\(\)\n)/, `$1${FACTORY}`);
      if (!src.includes('OkHttpClientProvider.setOkHttpClientFactory')) {
        throw new Error('with-okhttp-ping: could not find onCreate() in MainApplication');
      }
    }
    mod.modResults.contents = src;
    return mod;
  });
};
