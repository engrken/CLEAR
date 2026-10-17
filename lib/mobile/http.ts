// /lib/mobile/http.ts
//
// Plumbing for the /api/mobile route handlers: one JSON error shape
// ({ error: { code, message } }), CORS for allow-listed web origins (Expo web in
// development; native apps send no Origin), and safe body parsing.

import { NextResponse } from 'next/server';
import { DomainError } from '@/lib/errors';
import { OtpError } from '@/lib/otp';

export class ApiFailure extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = 'ApiFailure';
  }
}

const DOMAIN_STATUS: Record<string, number> = {
  invalid: 400,
  not_found: 404,
  conflict: 409,
  duplicate_or: 409,
  invalid_student: 422,
  payload_too_large: 413,
  rate_limited: 429,
};

const OTP_STATUS: Record<string, number> = {
  not_officer: 403,
  inactive_org: 403,
  daily_limit: 429,
  cooldown: 429,
  locked: 429,
  no_code: 400,
  expired: 400,
  mismatch: 400,
  send_failed: 502,
};

function allowedOrigins() {
  return String(process.env.MOBILE_CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  if (!origin || !allowedOrigins().includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

export function json(req: Request, data: unknown, status = 200) {
  const res = status === 204 ? new NextResponse(null, { status }) : NextResponse.json(data, { status });
  for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export function failure(req: Request, status: number, code: string, message: string) {
  return json(req, { error: { code, message } }, status);
}

function toFailure(err: unknown): ApiFailure {
  if (err instanceof ApiFailure) return err;
  if (err instanceof DomainError) return new ApiFailure(DOMAIN_STATUS[err.code] ?? 400, err.code, err.message);
  if (err instanceof OtpError) return new ApiFailure(OTP_STATUS[err.code] ?? 400, err.code, err.message);
  console.error('[api/mobile] unhandled error:', err);
  return new ApiFailure(500, 'server_error', 'Something went wrong on our side. Please try again.');
}

/**
 * Wraps a route handler: returns its value as JSON (or passes a Response through)
 * and turns thrown ApiFailure / DomainError / OtpError into the JSON error shape.
 */
export function handler<Ctx>(fn: (req: Request, ctx: Ctx) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx) => {
    try {
      const out = await fn(req, ctx);
      if (out instanceof Response) {
        for (const [k, v] of Object.entries(corsHeaders(req))) out.headers.set(k, v);
        return out;
      }
      return json(req, out);
    } catch (err) {
      const f = toFailure(err);
      return failure(req, f.status, f.code, f.message);
    }
  };
}

/** CORS preflight for every /api/mobile route. */
export function preflight(req: Request) {
  return json(req, null, 204);
}

const MAX_JSON_BYTES = 64 * 1024;

export async function readJson<T extends Record<string, unknown>>(req: Request): Promise<Partial<T>> {
  const text = await req.text();
  if (text.length > MAX_JSON_BYTES) throw new ApiFailure(413, 'payload_too_large', 'Request body is too large.');
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return parsed as Partial<T>;
  } catch {
    throw new ApiFailure(400, 'invalid', 'Request body must be a JSON object.');
  }
}

export function requireString(value: unknown, field: string, max = 200): string {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) throw new ApiFailure(400, 'invalid', `${field} is required.`);
  if (s.length > max) throw new ApiFailure(400, 'invalid', `${field} is too long.`);
  return s;
}

export function requireCentavos(value: unknown, field: string): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new ApiFailure(400, 'invalid', `${field} must be a positive whole number of centavos.`);
  if (n > 100_000_000) throw new ApiFailure(400, 'invalid', `${field} is too large.`);
  return n;
}

/** Public origin for links (QR verification URLs): AUTH_URL when set, else the forwarded host. */
export function publicBaseUrl(req: Request) {
  const configured = String(process.env.AUTH_URL || '').replace(/\/+$/, '');
  if (configured) return configured;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
