'use client';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { sanitizeTelemetryEvent } from '@/lib/telemetry-privacy';

/** No user-specific paths, search parameters or certificate tokens sent. */
export default function PrivacySafeTelemetry() {
  return (
    <>
      <Analytics beforeSend={sanitizeTelemetryEvent} />
      <SpeedInsights beforeSend={sanitizeTelemetryEvent} sampleRate={0.5} />
    </>
  );
}
