import type { MetadataRoute } from 'next';

/**
 * Web app manifest. Students on Android who reach the site before they install
 * the app can add it to the home screen, and it opens without browser chrome
 * under the right name and icon instead of "matric-mate-web.vercel.app".
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MatricMate · FBISE Class 9 exam preparation',
    short_name: 'MatricMate',
    description:
      'Chapter notes, audio lessons, past papers and a 24/7 AI tutor for FBISE Class 9, in English and Urdu medium.',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
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
