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
const fromEnv = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const SITE_URL = fromEnv
  ? fromEnv.startsWith('http')
    ? fromEnv
    : `https://${fromEnv}`
  : 'http://localhost:3000';

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
