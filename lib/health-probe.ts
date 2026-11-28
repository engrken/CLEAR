export type DatabaseHealthProbeResult = {
  ok: boolean;
  latencyMs: number;
  errorName: string | null;
  errorCode: string | null;
};

const SAFE_ERROR_NAMES = new Set([
  "Error",
  "PrismaClientInitializationError",
  "PrismaClientKnownRequestError",
  "PrismaClientUnknownRequestError",
  "PrismaClientRustPanicError",
  "PrismaClientValidationError",
]);
const SAFE_ERROR_CODE = /^(?:P\d{4}|ECONNRESET|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|EHOSTUNREACH|EAI_AGAIN)$/;
const MAX_RECORDED_LATENCY_MS = 120_000;

function safeErrorMetadata(error: unknown) {
  const candidate = error && typeof error === "object"
    ? error as { name?: unknown; code?: unknown }
    : {};

  return {
    errorName: typeof candidate.name === "string" && SAFE_ERROR_NAMES.has(candidate.name)
      ? candidate.name
      : "UnknownError",
    errorCode: typeof candidate.code === "string" && SAFE_ERROR_CODE.test(candidate.code)
      ? candidate.code
      : null,
  };
}

function elapsedMilliseconds(startedAt: number, endedAt: number) {
  const elapsed = endedAt - startedAt;
  if (!Number.isFinite(elapsed)) return 0;
  return Math.min(MAX_RECORDED_LATENCY_MS, Math.max(0, Math.round(elapsed)));
}

/**
 * Executes one caller-supplied, read-only database probe and returns only
 * bounded timing and allow-listed error metadata. Raw error messages,
 * connection details, query text, and credentials are never returned.
 */
export async function runDatabaseHealthProbe(
  query: () => Promise<unknown>,
  now: () => number = Date.now,
): Promise<DatabaseHealthProbeResult> {
  const startedAt = now();

  try {
    await query();
    return {
      ok: true,
      latencyMs: elapsedMilliseconds(startedAt, now()),
      errorName: null,
      errorCode: null,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: elapsedMilliseconds(startedAt, now()),
      ...safeErrorMetadata(error),
    };
  }
}
