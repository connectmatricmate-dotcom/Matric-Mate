import type { MetadataRoute } from 'next';
import { ALLOW_INDEXING, canonicalUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  if (!ALLOW_INDEXING) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Nothing behind the login is useful to a crawler, and the checkout
        // should never appear in a search result. Nor should the staff areas,
        // a teacher's referral redirect, or the email-link handlers.
        disallow: [
          '/dashboard',
          '/study',
          '/practice',
          '/tutor',
          '/progress',
          '/learn/',
          '/session/',
          '/insights/',
          '/account/',
          '/upgrade',
          '/notifications',
          '/certificates',
          '/checkout',
          '/onboarding/',
          '/admin',
          '/affiliate',
          '/r/',
          '/auth/',
          '/reset',
          '/api/',
        ],
      },
    ],
    sitemap: canonicalUrl('/sitemap.xml'),
  };
}
