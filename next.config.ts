import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Each report header logo is validated at <= 5 MiB; allow a form submission
  // containing both images plus the school name/address to reach that validator.
  serverActions: {
    bodySizeLimit: '12mb',
  },
};

export default nextConfig;
