import type { MetadataRoute } from 'next';

/**
 * Web app manifest: the name, the icon and the brand colours a browser should
 * use for this site. It is NOT an offer to install.
 *
 * `display` was 'standalone', which is the one field that decides that. With
 * it, plus the service worker that web push needs, Chrome on Android meets its
 * own installability rules and starts pushing "Install app" at every student
 * on the site. We ship a real Android app; a second, worse copy of the website
 * pretending to be it is not something to advertise, and the two would have
 * shown up side by side in the launcher under the same name and icon.
 *
 * 'browser' fails those rules deliberately. The icon, the name and the theme
 * colour all still apply, so a bookmark or a home-screen shortcut somebody
 * makes for themselves still looks right.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MatricMate · Class 9 and 10 exam preparation',
    short_name: 'MatricMate',
    description:
      'Chapter notes, audio lessons, past papers and a 24/7 AI tutor for FBISE and Punjab Board Class 9 and 10, in English and Urdu medium.',
    start_url: '/dashboard',
    display: 'browser',
    background_color: '#FAFBF7',
    theme_color: '#096A8B',
    categories: ['education'],
    lang: 'en',
    icons: [
      { src: '/brand/favicon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
