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
 * Search engines are kept out until the content is the client's own.
 *
 * Right now the app runs on sample chapters and a checkout that takes no money.
 * Getting indexed in that state means Google's first impression of MatricMate
 * is a demo, and "no real payment is taken" ends up in a search snippet under
 * the brand. Set NEXT_PUBLIC_ALLOW_INDEXING=true on launch day. One variable,
 * no redeploy of anything else.
 */
export const ALLOW_INDEXING = process.env.NEXT_PUBLIC_ALLOW_INDEXING === 'true';

/**
 * The one version string every screen shows. Two screens once carried two
 * different hard-coded versions, one tap apart.
 */
export const APP_VERSION = '0.2.1';
