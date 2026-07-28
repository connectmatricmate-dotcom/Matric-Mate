import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The shared package ships TypeScript source, so Next must compile it.
  transpilePackages: ['@matricmate/core'],
  images: { formats: ['image/avif', 'image/webp'] },
};

export default nextConfig;
