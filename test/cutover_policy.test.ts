import assert from "node:assert/strict";
import test from "node:test";
import { cutoverRequestSchema, decideCutover } from "../src/cutover_policy.js";

const baseRequest = {
  changeId: "chg_20260927_001",
  domain: "payments.example.com",
  recordName: "api",
  currentAddress: "192.0.2.10",
  targetAddress: "198.51.100.20",
  ttl: 60,
  approvedBy: "operator@example.com",
  paymentEvents: [
    {
      eventId: "evt_101",
      kind: "authorization" as const,
      amountMinor: 1299,
      currency: "USD",
      riskScore: 92
    }
  ]
};

test("a high-risk payment pauses a forward cutover", () => {
  const input = cutoverRequestSchema.parse({ ...baseRequest, action: "cutover" });
  assert.deepEqual(decideCutover(input), {
    allowed: false,
    reason: "Cutover paused after a high-risk payment event",
    destination: "198.51.100.20",
    observedEvents: 1,
    highRiskEvents: 1
  });
});

test("rollback stays available when a high-risk payment is present", () => {
  const input = cutoverRequestSchema.parse({ ...baseRequest, action: "rollback" });
  const decision = decideCutover(input);
  assert.equal(decision.allowed, true);
  assert.equal(decision.destination, "192.0.2.10");
});
