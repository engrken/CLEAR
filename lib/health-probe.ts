export type DatabaseHealthProbeResult = {
  ok: boolean;
  latencyMs: number;
  errorName: string | null;
  errorCode: string | null;
};

const SAFE_ERROR_CODE = /^(?:P\d{4}|ECONNRESET|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|EHOSTUNREACH|EAI_AGAIN)$/;
const SAFE_ERROR_NAME = /^[A-Za-z][A-Za-z0-9_]{0,59}$/;

function safeErrorMetadata(error: unknown) {
  const candidate = error && typeof error === "object"
    ? error as { name?: unknown; code?: unknown }
    : {};

  return {
    errorName: typeof candidate.name === "string" && SAFE_ERROR_NAME.test(candidate.name)
      ? candidate.name
      : "UnknownError",
    errorCode: typeof candidate.code === "string" && SAFE_ERROR_CODE.test(candidate.code)
      ? candidate.code
      : null,
  };
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
      latencyMs: Math.max(0, Math.round(now() - startedAt)),
      errorName: null,
      errorCode: null,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Math.max(0, Math.round(now() - startedAt)),
      ...safeErrorMetadata(error),
    };
  }
}
