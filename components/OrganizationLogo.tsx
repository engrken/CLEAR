'use client';

import { useState, type ImgHTMLAttributes } from 'react';
import { DEFAULT_ORGANIZATION_LOGO, getOrganizationLogoSrc } from '@/lib/organization-logo';

type OrganizationLogoProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'onError'
> & {
  src?: string | null;
  alt: string;
};

/**
 * Shared tenant logo: saved upload first; CLEAR only if absent or image fails.
 * Failed-image tracking is per source, so switching tenants never carries a
 * broken-image flag into a different organization's custom logo.
 */
export default function OrganizationLogo({ src, alt, ...imageProps }: OrganizationLogoProps) {
  const preferred = getOrganizationLogoSrc(src);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const actualSrc = failedSrc === preferred ? DEFAULT_ORGANIZATION_LOGO : preferred;

  return (
    <img
      {...imageProps}
      src={actualSrc}
      alt={alt}
      onError={() => {
        if (actualSrc !== DEFAULT_ORGANIZATION_LOGO) setFailedSrc(preferred);
      }}
    />
  );
}
