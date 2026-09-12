import type { MetadataRoute } from 'next';
import { canonicalUrl } from '@/lib/site';

/**
 * Only the public pages. Everything else needs an account.
 *
 * On the canonical address whichever host serves this file, so the sitemap and
 * the pages' own canonical links never name two different sites. The legal
 * pages are listed too: a payment gateway reviewing the merchant and Google
 * Play, which requires the account-deletion page to be reachable, both look
 * for them.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: canonicalUrl('/'), lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: canonicalUrl('/pricing'), lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: canonicalUrl('/services'), lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: canonicalUrl('/signup'), lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: canonicalUrl('/login'), lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: canonicalUrl('/terms'), lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: canonicalUrl('/privacy'), lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: canonicalUrl('/refunds'), lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: canonicalUrl('/delete-account'), lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
