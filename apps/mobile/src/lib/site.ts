/**
 * Where the web app lives.
 *
 * The same literal was written out in three files, so a deployment moving
 * would have needed three edits and would have half-worked after two. The
 * fallback matches the production deployment, so a build made without the env
 * var still reaches a real server rather than failing quietly.
 *
 * Opening a page here is not the same as selling: see core/billing.ts. Only
 * pages with no price and no checkout on them may be opened from the app.
 */
export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://www.matricmate.co';
