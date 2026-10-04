import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/',
        destination: '/portal',
        permanent: true, // Permanent SEO-friendly redirect
      },
    ];
  },
};

export default nextConfig;