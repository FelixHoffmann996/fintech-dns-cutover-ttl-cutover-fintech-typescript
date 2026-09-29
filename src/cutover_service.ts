import {
  cutoverRequestSchema,
  decideCutover,
  type CutoverRequest
} from "./cutover_policy.js";
import { InfraiDnsClient } from "./infrai_dns.js";

export type AuditNotification = {
  changeId: string;
  action: CutoverRequest["action"];
  approvedBy: string;
  decision: "applied" | "paused";
  reason: string;
  record: { name: string; address: string; ttl: number };
  paymentSummary: { observed: number; highRisk: number };
};

export async function applyCutover(
  rawInput: unknown,
  dns: InfraiDnsClient
): Promise<AuditNotification> {
  const input = cutoverRequestSchema.parse(rawInput);
  const decision = decideCutover(input);

  const audit: AuditNotification = {
    changeId: input.changeId,
    action: input.action,
    approvedBy: input.approvedBy,
    decision: decision.allowed ? "applied" : "paused",
    reason: decision.reason,
    record: {
      name: input.recordName,
      address: decision.destination,
      ttl: input.ttl
    },
    paymentSummary: {
      observed: decision.observedEvents,
      highRisk: decision.highRiskEvents
    }
  };

  if (!decision.allowed) return audit;

  const zone_id = await dns.getZoneId(input.domain);
  await dns.upsertARecord({
    zone_id,
    name: input.recordName,
    content: decision.destination,
    ttl: input.ttl,
    idempotencyKey: input.changeId
  });

  return audit;
}
