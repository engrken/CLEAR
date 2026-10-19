import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // Default Server Action cap is 1 MiB. Report settings support two
    // separately validated PNG/JPEG/WebP logos of up to 5 MiB each.
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
};

export default nextConfig;
