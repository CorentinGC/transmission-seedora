import type { NextConfig } from 'next';
import withPWAInit from '@ducanh2912/next-pwa';
import { buildSecurityHeaders, resolveSecurityEnvironment } from './src/lib/security-headers';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
});

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

export default withPWA(nextConfig);
