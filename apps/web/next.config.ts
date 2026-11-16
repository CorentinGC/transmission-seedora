import type { NextConfig } from 'next';
import { buildSecurityHeaders, resolveSecurityEnvironment } from './src/lib/security-headers';

const nextConfig: NextConfig = {
  transpilePackages: ['@seedora/shared'],
  serverExternalPackages: ['geoip-lite'],
  turbopack: {},
  // The production build skips test files: Vercel installs only this workspace, so test tooling
  // (vitest, playwright) is absent. `npm run typecheck` still checks them with tsconfig.json.
  typescript: { tsconfigPath: 'tsconfig.build.json' },
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
