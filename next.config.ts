import { resolve } from 'node:path';
import type { NextConfig } from 'next';

// In the sibling-checkout layout, @mediconnect/design-system is a symlink into ../shared. Let Turbopack follow it.
const sharedCheckout = resolve(process.cwd(), '../shared');
const turbopackAdditionalRoots = { sharedPackages: { path: sharedCheckout, ignoreIfMissing: true } };

/** Back office: never indexed, never cached, no framing. */
const nextConfig: NextConfig = {
  experimental: { turbopackAdditionalRoots },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },
};

export default nextConfig;
