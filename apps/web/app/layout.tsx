import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { ToastProvider } from '@/components/ui/toast';
import { ALLOW_INDEXING, SITE_URL } from '@/lib/site';
import './globals.css';

/*
 * The font files live in this repo, and that is the point.
 *
 * These were `next/font/google`, which downloads from fonts.gstatic.com during
 * the build. That worked until Google started returning 404 for the pinned
 * Baloo 2 revision, and every Vercel deploy failed: a production build that
 * cannot ship because a third party changed a URL. The local build passed only
 * because it had the files cached from an earlier run, which is the worst kind
 * of green.
 *
 * All three are variable fonts, so one file each covers the whole weight range
 * we use. Total 384KB, and the Nastaliq is 236KB of it.
 */
const baloo = localFont({
  src: './fonts/baloo2.woff2',
  weight: '500 800',
  display: 'swap',
  variable: '--font-baloo',
});

const nunito = localFont({
  src: './fonts/nunito.woff2',
  weight: '400 800',
  display: 'swap',
  variable: '--font-nunito',
});

// preload:false on purpose: the Nastaliq woff2 is ~240KB, an order of magnitude
// heavier than the Latin faces, and preloading it put a high-priority fetch on
// every route for every visitor, including English-medium students who never
// render an Urdu glyph. Without the hint the browser fetches it lazily, only
// when Urdu text actually appears.
const nastaliq = localFont({
  src: './fonts/nastaliq.woff2',
  weight: '400 700',
  display: 'swap',
  variable: '--font-nastaliq',
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  robots: ALLOW_INDEXING ? undefined : { index: false, follow: false },
  title: {
    default: 'MatricMate · FBISE Class 9 and 10 exam preparation',
    template: '%s · MatricMate',
  },
  description:
    'Chapter-wise notes, audio lessons, past papers and a 24/7 AI tutor for FBISE Class 9 and Class 10, in English and Urdu medium. Practise, find your weak topics, and walk into the exam ready.',
  keywords: ['FBISE', 'Class 9', 'Class 10', 'SSC', 'matric', 'past papers', 'Pakistan', 'exam preparation', 'Urdu medium'],
  openGraph: {
    title: 'MatricMate · FBISE Class 9 and 10 exam preparation',
    description: 'Notes, audio lessons, past papers and an AI tutor for FBISE Class 9 and Class 10, in English and Urdu.',
    siteName: 'MatricMate',
    locale: 'en_PK',
    type: 'website',
    /*
     * Without an image a shared link renders as a grey box with a URL under it,
     * and WhatsApp is how this product will actually get passed around.
     *
     * icon-512 rather than the 1024: WhatsApp fetches preview images with a
     * tight size budget and quietly drops anything much over a few hundred KB,
     * and the 1024 is 1.2MB. 512 square also clears the 200px minimum that
     * Facebook and LinkedIn enforce.
     */
    images: [{ url: '/brand/icon-512.png', width: 512, height: 512, alt: 'MatricMate' }],
  },
  twitter: {
    card: 'summary',
    title: 'MatricMate · FBISE Class 9 exam preparation',
    description: 'Notes, audio lessons, past papers and an AI tutor for FBISE Class 9, in English and Urdu.',
    images: ['/brand/icon-512.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#096A8B',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  /**
   * No AppProvider here on purpose. The store binds the shared content dataset
   * and both language dictionaries into whatever client bundle mounts it, and
   * at the root that meant the marketing pages, terms and pricing all shipped
   * ~340KB of study data they never read. The segments that use the store,
   * (app), (auth), onboarding and checkout, each mount it in their own layout.
   */
  return (
    <html lang="en" className={`${baloo.variable} ${nunito.variable} ${nastaliq.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
