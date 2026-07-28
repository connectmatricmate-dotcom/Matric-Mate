import type { MetadataRoute } from 'next';
import { ALLOW_INDEXING, SITE_URL } from '@/lib/site';

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
        // should never appear in a search result.
        disallow: ['/dashboard', '/study', '/practice', '/tutor', '/progress', '/learn/', '/session/', '/insights/', '/account/', '/checkout', '/onboarding/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
