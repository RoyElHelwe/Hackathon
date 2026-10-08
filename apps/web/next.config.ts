import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import withSerwistInit from '@serwist/next';
import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

loadEnv({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const API_URL = (process.env.API_URL || 'http://localhost:4000').replace(/\s+#.*$/, '');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development' || process.env.DISABLE_PWA === 'true',
  cacheOnNavigation: true,
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@tajriba/shared'],
  outputFileTracingRoot: path.resolve(__dirname, '../..'),
  eslint: { dirs: ['src'] },
  // Same-origin API: the httpOnly session cookie works without CORS.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/:path*` }];
  },
  experimental: { proxyTimeout: 60_000 },
};

export default withSerwist(withNextIntl(nextConfig));
