import type { NextConfig } from 'next';
import { buildSecurityHeaders, resolveSecurityEnvironment } from './src/lib/security-headers';

const nextConfig: NextConfig = {
  transpilePackages: ['@seedora/shared'],
  serverExternalPackages: ['geoip-lite'],
  turbopack: {},
  async headers() {
    return [
      {
        source: '/:path*',
        headers: buildSecurityHeaders(resolveSecurityEnvironment(process.env)),
      },
    ];
  },
};

export default nextConfig;
