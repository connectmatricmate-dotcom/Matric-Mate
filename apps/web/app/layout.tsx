import type { Metadata, Viewport } from 'next';
import { Baloo_2, Noto_Nastaliq_Urdu, Nunito } from 'next/font/google';
import { AppProvider } from '@/lib/store';
import './globals.css';

// Self-hosted at build time — no runtime request to a font CDN.
const baloo = Baloo_2({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-baloo' });
const nunito = Nunito({ subsets: ['latin'], weight: ['400', '600', '700', '800'], variable: '--font-nunito' });
const nastaliq = Noto_Nastaliq_Urdu({ subsets: ['arabic'], weight: ['400', '600'], variable: '--font-nastaliq' });

export const metadata: Metadata = {
  metadataBase: new URL('https://matricmate.pk'),
  title: {
    default: 'MatricMate — FBISE Class 9 exam preparation',
    template: '%s · MatricMate',
  },
  description:
    'Chapter-wise notes, audio lessons, past papers and a 24/7 AI tutor for FBISE Class 9 — English and Urdu medium. Practise, find your weak topics, and walk into the exam ready.',
  keywords: ['FBISE', 'Class 9', 'matric', 'past papers', 'Pakistan', 'exam preparation', 'Urdu medium'],
  openGraph: {
    title: 'MatricMate — FBISE Class 9 exam preparation',
    description: 'Notes, audio lessons, past papers and an AI tutor for FBISE Class 9, in English and Urdu.',
    siteName: 'MatricMate',
    locale: 'en_PK',
    type: 'website',
  },
  icons: { icon: '/brand/favicon-192.png', apple: '/brand/icon-1024.png' },
};

export const viewport: Viewport = {
  themeColor: '#096A8B',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${baloo.variable} ${nunito.variable} ${nastaliq.variable}`}>
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
