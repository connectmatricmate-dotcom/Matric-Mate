/**
 * Where this deployment lives, and whether it is the real thing.
 *
 * Three cases, in order:
 *   1. NEXT_PUBLIC_SITE_URL   set by us on the production deployment
 *   2. VERCEL_PROJECT_PRODUCTION_URL   Vercel fills this in automatically
 *   3. localhost   development
 *
 * Getting this wrong is not cosmetic: metadataBase feeds every Open Graph image
 * and canonical link, so a preview build with the production URL hard-coded
 * tells WhatsApp and Google to go and fetch a page that doesn't exist yet.
 */
const withScheme = (host?: string) => (host ? (host.startsWith('http') ? host : `https://${host}`) : undefined);

const configured = withScheme(process.env.NEXT_PUBLIC_SITE_URL);
const onVercel = withScheme(process.env.VERCEL_PROJECT_PRODUCTION_URL);

/**
 * A localhost value is only ever meant for a laptop. If one reaches a deployed
 * build it is a copied .env, and honouring it would be quietly catastrophic:
 * Safepay would send payers back to localhost after they had paid, and every
 * share card would point at a machine nobody else can reach. Vercel's own URL
 * wins in that case, because it is the one thing here that cannot be wrong.
 */
const isLocal = (url?: string) => !!url && /^https?:\/\/(localhost|127\.0\.0\.1)/.test(url);

export const SITE_URL =
  (isLocal(configured) && onVercel ? onVercel : configured) ?? onVercel ?? 'http://localhost:3000';

/**
 * Whether search engines may index the site: only when
 * NEXT_PUBLIC_ALLOW_INDEXING is exactly 'true'.
 *
 * Off, and that is the client's decision, made in the Vercel environment rather
 * than here. The reason this used to give (sample chapters, a checkout that
 * took no money) is out of date: the content and the payments are live. So the
 * switch stays where it is, and turning it on is one variable and a redeploy.
 */
export const ALLOW_INDEXING = process.env.NEXT_PUBLIC_ALLOW_INDEXING === 'true';

/**
 * The address search engines should credit with every public page.
 *
 * The same deployment also answers on matric-mate-web.vercel.app, and without
 * a canonical link the two addresses would be indexed as duplicate copies of
 * one site. A constant rather than SITE_URL on purpose: a preview deployment
 * has to point search engines at production, never at itself.
 */
export const CANONICAL_ORIGIN = 'https://www.matricmate.co';

/** The canonical URL for a public path, for `alternates.canonical` and the sitemap. */
export const canonicalUrl = (path: string): string => `${CANONICAL_ORIGIN}${path}`;

/**
 * The one version string every screen shows. Two screens once carried two
 * different hard-coded versions, one tap apart. Kept in step with the Android
 * release (apps/mobile/app.json), so a student reading it out to support
 * gives one number whichever they use; it said 0.2.1 three releases on.
 */
export const APP_VERSION = '0.6.1';
