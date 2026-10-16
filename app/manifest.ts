 appmanifest.ts
import { MetadataRoute } from 'next';

export default function manifest() MetadataRoute.Manifest {
  return {
    name 'CLEAR System - Financial & Audit Ledger',
    short_name 'CLEAR System',
    description 'Centralized Liquidation of Expenses & Audit Records',
    start_url 'dashboard',
    display 'standalone',
    background_color '#121212',
    theme_color '#0dcaf0',
    orientation 'portrait',
    icons [
      {
        src 'icon-192x192.png',
        sizes '192x192',
        type 'imagepng',
      },
      {
        src 'icon-512x512.png',
        sizes '512x512',
        type 'imagepng',
      },
    ],
  };
}