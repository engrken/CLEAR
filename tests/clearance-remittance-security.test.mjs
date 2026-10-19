import test from "node:test";
import assert from "node:assert/strict";
import { isClosedPenaltyStatus, isOutstandingPenalty } from "../lib/penalty-clearance-status.ts";
import { ingressClientIp, normalizePublicPaymentChannel } from "../lib/public-remittance-security.ts";

test("UNSETTLED does not match SETTLED: cash and service penalties with a positive balance remain owed", () => {
  for (const status of ["Unsettled", "UNSETTLED", "Partially Paid (Cash Payment)", "Pending"]) {
    assert.equal(isClosedPenaltyStatus(status), false, status);
    assert.equal(isOutstandingPenalty({ status, fineAmount: 120.5 }), true, status);
  }
});

test("closed, voided, cancelled and zero-balance penalties do not impose current-term holds", () => {
  for (const status of ["Settled", "Settled (Cash Payment)", "VOIDED", "Cancelled"]) {
    assert.equal(isClosedPenaltyStatus(status), true, status);
    assert.equal(isOutstandingPenalty({ status, fineAmount: 250 }), false, status);
  }
  for (const amount of [0, -50, Number.NaN, Infinity, null]) {
    assert.equal(isOutstandingPenalty({ status: "Unsettled", fineAmount: amount }), false);
  }
});

test("strict payment channels, with harmless capitalization aliases", () => {
  for (const [input, expected] of [
    ["GCash", "GCash"], [" gcash ", "GCash"], ["Maya", "Maya"],
    ["PayMaya", "Maya"], [" Bank   Transfer ", "Bank Transfer"],
  ]) assert.equal(normalizePublicPaymentChannel(input), expected);
  for (const input of ["Cash", "crypto", "", null, "Bank Transfer;drop table", "GCash,Maya"]) {
    assert.equal(normalizePublicPaymentChannel(input), null);
  }
});

test("uses last trusted-proxy hop for IP throttle instead of spoofable first XFF hop", () => {
  const headers = new Headers({
    "x-forwarded-for": "198.51.100.1, 203.0.113.7",
    "x-real-ip": "192.0.2.99",
  });
  assert.equal(ingressClientIp(headers), "203.0.113.7");
  assert.equal(ingressClientIp(new Headers({ "x-real-ip": "192.0.2.3" })), "192.0.2.3");
  assert.equal(ingressClientIp(new Headers()), "unknown");
});
