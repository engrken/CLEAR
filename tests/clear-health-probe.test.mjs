import test from "node:test";
import assert from "node:assert/strict";
import { runDatabaseHealthProbe } from "../lib/health-probe.ts";

test("reports successful read-only probe latency", async () => {
  let clock = 100;
  let calls = 0;
  const result = await runDatabaseHealthProbe(async () => {
    calls += 1;
    clock = 137;
    return 1;
  }, () => clock);

  assert.equal(calls, 1);
  assert.deepEqual(result, {
    ok: true,
    latencyMs: 37,
    errorName: null,
    errorCode: null,
  });
});

test("reports failure latency and only allow-listed Prisma metadata", async () => {
  let clock = 200;
  const error = Object.assign(
    new Error("connection string contains sensitive information"),
    { name: "PrismaClientInitializationError", code: "P1001" },
  );

  const result = await runDatabaseHealthProbe(async () => {
    clock = 264;
    throw error;
  }, () => clock);

  assert.deepEqual(result, {
    ok: false,
    latencyMs: 64,
    errorName: "PrismaClientInitializationError",
    errorCode: "P1001",
  });
  assert.equal("message" in result, false);
  assert.equal(JSON.stringify(result).includes("sensitive"), false);
});

test("replaces unknown error names even when they contain only safe-looking characters", async () => {
  const result = await runDatabaseHealthProbe(async () => {
    throw Object.assign(new Error("sensitive details"), {
      name: "DatabaseCredentialLeak",
      code: "ETIMEDOUT",
    });
  });

  assert.equal(result.errorName, "UnknownError");
  assert.equal(result.errorCode, "ETIMEDOUT");
  assert.equal(JSON.stringify(result).includes("Credential"), false);
});

test("drops unrecognized error codes and never exposes raw error messages", async () => {
  const result = await runDatabaseHealthProbe(async () => {
    throw Object.assign(new Error("password=do-not-log"), {
      code: "PRIVATE_HOST_AND_CREDENTIAL",
    });
  });

  assert.equal(result.ok, false);
  assert.equal(result.errorCode, null);
  assert.equal(result.errorName, "Error");
  assert.equal(JSON.stringify(result).includes("password"), false);
  assert.equal(JSON.stringify(result).includes("PRIVATE_HOST"), false);
});

test("clamps clock skew and caps non-finite or excessive latency values", async (t) => {
  await t.test("clock skew", async () => {
    const times = [500, 490];
    const result = await runDatabaseHealthProbe(async () => undefined, () => times.shift() ?? 490);
    assert.equal(result.latencyMs, 0);
  });

  await t.test("excessive duration", async () => {
    let clock = 0;
    const result = await runDatabaseHealthProbe(async () => {
      clock = 999_999;
    }, () => clock);
    assert.equal(result.latencyMs, 120_000);
  });

  await t.test("non-finite duration", async () => {
    const times = [Number.NaN, Number.POSITIVE_INFINITY];
    const result = await runDatabaseHealthProbe(async () => undefined, () => times.shift() ?? 0);
    assert.equal(result.latencyMs, 0);
  });
});
