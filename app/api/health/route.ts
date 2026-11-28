import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runDatabaseHealthProbe } from "@/lib/health-probe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// Allow the read-only probe to finish within Cognix's 15-second health window.
export const maxDuration = 30;

const headers = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function GET() {
  const checkedAt = new Date().toISOString();

  // Keep this as a minimal, read-only connectivity check. Timing is recorded
  // separately so operators can distinguish slow database readiness from
  // a failed HTTP response, without exposing the database error itself.
  const probe = await runDatabaseHealthProbe(() => prisma.$queryRaw`SELECT 1`);

  if (probe.ok) {
    console.info("[clear-health] database readiness passed", {
      databaseLatencyMs: probe.latencyMs,
    });

    return NextResponse.json({
      service: "clear-sys",
      status: "ok",
      database: "ok",
      databaseLatencyMs: probe.latencyMs,
      checkedAt,
    }, { headers });
  }

  // Only allow-listed error metadata is logged; never log raw messages,
  // connection strings, query parameters, user records, or credentials.
  console.warn("[clear-health] database readiness check failed", {
    databaseLatencyMs: probe.latencyMs,
    errorName: probe.errorName,
    errorCode: probe.errorCode,
  });

  return NextResponse.json({
    service: "clear-sys",
    status: "degraded",
    database: "unavailable",
    databaseLatencyMs: probe.latencyMs,
    checkedAt,
  }, { status: 503, headers });
}
