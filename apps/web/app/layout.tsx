import type { Metadata, Viewport } from 'next';
import { Baloo_2, Noto_Nastaliq_Urdu, Nunito } from 'next/font/google';
import { ToastProvider } from '@/components/ui/toast';
import { ALLOW_INDEXING, SITE_URL } from '@/lib/site';
import './globals.css';

// Self-hosted at build time, no runtime request to a font CDN.
const baloo = Baloo_2({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-baloo' });
const nunito = Nunito({ subsets: ['latin'], weight: ['400', '600', '700', '800'], variable: '--font-nunito' });
// preload:false on purpose: the Nastaliq woff2 is ~240KB, an order of magnitude
// heavier than the Latin faces, and preloading it put a high-priority fetch on
// every route for every visitor, including English-medium students who never
// render an Urdu glyph. Without the hint the browser fetches it lazily, only
// when Urdu text actually appears.
const nastaliq = Noto_Nastaliq_Urdu({ subsets: ['arabic'], weight: ['400', '600'], variable: '--font-nastaliq', preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  robots: ALLOW_INDEXING ? undefined : { index: false, follow: false },
  title: {
    default: 'MatricMate · FBISE Class 9 exam preparation',
    template: '%s · MatricMate',
  },
  description:
    'Chapter-wise notes, audio lessons, past papers and a 24/7 AI tutor for FBISE Class 9, in English and Urdu medium. Practise, find your weak topics, and walk into the exam ready.',
  keywords: ['FBISE', 'Class 9', 'matric', 'past papers', 'Pakistan', 'exam preparation', 'Urdu medium'],
  openGraph: {
    title: 'MatricMate · FBISE Class 9 exam preparation',
    description: 'Notes, audio lessons, past papers and an AI tutor for FBISE Class 9, in English and Urdu.',
    siteName: 'MatricMate',
    locale: 'en_PK',
    type: 'website',
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
