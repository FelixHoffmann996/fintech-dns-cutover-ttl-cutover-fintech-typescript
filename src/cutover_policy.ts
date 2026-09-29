import { z } from "zod";

export const paymentEventSchema = z.object({
  eventId: z.string().min(1),
  kind: z.enum(["authorization", "capture", "refund"]),
  amountMinor: z.number().int().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  riskScore: z.number().min(0).max(100)
});

export const cutoverRequestSchema = z.object({
  changeId: z.string().min(8),
  domain: z.string().min(3),
  recordName: z.string().min(1),
  currentAddress: z.string().ip({ version: "v4" }),
  targetAddress: z.string().ip({ version: "v4" }),
  ttl: z.number().int().min(30).max(300),
  action: z.enum(["cutover", "rollback"]),
  approvedBy: z.string().email(),
  paymentEvents: z.array(paymentEventSchema).min(1).max(100)
});

export type CutoverRequest = z.infer<typeof cutoverRequestSchema>;

export type CutoverDecision = {
  allowed: boolean;
  reason: string;
  destination: string;
  observedEvents: number;
  highRiskEvents: number;
};

export function decideCutover(input: CutoverRequest): CutoverDecision {
  const highRiskEvents = input.paymentEvents.filter(
    (event) => event.riskScore >= 80
  ).length;
  const allowed = input.action === "rollback" || highRiskEvents === 0;

  return {
    allowed,
    reason: allowed
      ? input.action === "rollback"
        ? "Rollback is always available"
        : "No high-risk payment events observed"
      : "Cutover paused after a high-risk payment event",
    destination:
      input.action === "rollback" ? input.currentAddress : input.targetAddress,
    observedEvents: input.paymentEvents.length,
    highRiskEvents
  };
}
