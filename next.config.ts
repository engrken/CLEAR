import type { NextConfig } from 'next';
import packageJson from './package.json';

const nextConfig: NextConfig = {
  env: {
    // Keep the footer synchronized with the shipped package version and Git revision.
    NEXT_PUBLIC_CLEAR_APP_VERSION: packageJson.version,
    NEXT_PUBLIC_CLEAR_BUILD_SHA:
      process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'local',
  },
  async headers() {
    return [{
      source: '/auth/mobile-handoff',
      headers: [
        { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        { key: 'Content-Security-Policy', value: "referrer no-referrer" },
      ],
    }, {
      source: '/clearance/verify',
      headers: [
        { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
      ],
    }];
  },
  experimental: {
    // Default Server Action cap is 1 MiB. Report settings support two
    // separately validated PNG/JPEG/WebP logos of up to 5 MiB each.
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
};

export default nextConfig;
