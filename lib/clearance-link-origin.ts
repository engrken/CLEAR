/**
 * Canonical website origin for signed CLEAR clearance-certificate links.
 *
 * Certificate paths may include student school IDs and HMAC signatures. Never
 * derive their origin from Host, X-Forwarded-Host or caller-controlled headers:
 * this could redirect authorized staff to an attacker-controlled host.
 *
 * Production links are pinned to CLEAR's official HTTPS domain, regardless of
 * AUTH_URL or deployment routing headers. Isolated Preview may use a Vercel
 * deployment URL. Local tests use only an explicitly configured origin or
 * loopback address, never arbitrary request hosts.
 */
const PRODUCTION_ORIGIN = 'https://clearsys.vercel.app';

type OriginEnvironment = {
  vercelEnv?: string;
  vercelUrl?: string;
  nodeEnv?: string;
  authUrl?: string;
};

export function clearanceLinkOrigin(
  env: OriginEnvironment = {
    vercelEnv: process.env.VERCEL_ENV,
    vercelUrl: process.env.VERCEL_URL,
    nodeEnv: process.env.NODE_ENV,
    authUrl: process.env.AUTH_URL,
  },
): string {
  if (env.vercelEnv === 'production') return PRODUCTION_ORIGIN;

  if (env.vercelEnv === 'preview' && env.vercelUrl) {
    try {
      const value = new URL('https://' + env.vercelUrl);
      if (
        value.hostname.endsWith('.vercel.app') &&
        value.hostname !== 'vercel.app' &&
        value.port === '' &&
        value.username === '' &&
        value.password === '' &&
        value.pathname === '/' &&
        !value.search &&
        !value.hash
      ) {
        return value.origin;
      }
    } catch {
      // Reject malformed or manipulated Preview origins.
    }
  }

  // AUTH_URL is a trusted server-side configuration, not a request header.
  // Allow HTTP only for loopback integration tests/local development.
  if (env.authUrl) {
    try {
      const value = new URL(env.authUrl);
      const loopback = value.hostname === '127.0.0.1' || value.hostname === 'localhost';
      if (
        !value.username &&
        !value.password &&
        !value.search &&
        !value.hash &&
        (value.protocol === 'https:' || (value.protocol === 'http:' && loopback))
      ) {
        return value.origin;
      }
    } catch {
      // Ignore unsafe or malformed server configuration and fail closed.
    }
  }

  return env.nodeEnv === 'development' ? 'http://localhost:3000' : PRODUCTION_ORIGIN;
}
