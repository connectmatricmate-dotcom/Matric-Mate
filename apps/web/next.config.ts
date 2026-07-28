import type { NextConfig } from 'next';

/**
 * Security headers.
 *
 * No CSP yet: it would have to be written against the real Supabase and Safepay
 * origins, and a wrong one breaks the site silently in a way nobody notices
 * until a student reports a blank page. It goes in with the backend, in report
 * mode first. Everything below is safe to set now and worth having from the
 * first public deploy.
 */
const SECURITY_HEADERS = [
  // Don't let the site be framed. Stops a lookalike page wrapping our checkout.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  // Never let a browser guess a response is something other than what we said.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Send the origin, not the full path, to third parties.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Nothing here needs a camera, a microphone or a location.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  // HTTPS only, for two years, once we are on the real domain.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  // The shared package ships TypeScript source, so Next must compile it.
  transpilePackages: ['@matricmate/core'],
  images: { formats: ['image/avif', 'image/webp'] },
  // A build that type-errors should fail, not ship. This is Next's default;
  // it is written out so nobody "fixes" a red build by turning it off.
  // (Next 16 no longer runs ESLint during `next build` — CI runs `npm run lint`.)
  typescript: { ignoreBuildErrors: false },
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
