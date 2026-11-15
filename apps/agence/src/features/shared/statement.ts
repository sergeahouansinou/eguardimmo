import { z } from "zod";

export const statementLineSchema = z.object({
  lotId: z.string(),
  lotLabel: z.string(),
  lotDescription: z.string(),
  tenantName: z.string(),
  paidOn: z.string().nullable(),
  calledMinor: z.number().int(),
  collectedMinor: z.number().int(),
  feeMinor: z.number().int(),
  netMinor: z.number().int(),
  unpaidSince: z.string().nullable(),
  reminders: z.number().int(),
});

export const mandantStatementSchema = z.object({
  mandantId: z.string(),
  mandantName: z.string(),
  mandantKind: z.string(),
  mandateRef: z.string(),
  ibanLast4: z.string(),
  period: z.string(),
  feeRateBasisPoints: z.number().int(),
  lines: z.array(statementLineSchema),
  calledMinor: z.number().int(),
  collectedMinor: z.number().int(),
  feeMinor: z.number().int(),
  netMinor: z.number().int(),
  worksDeductedMinor: z.number().int(),
  receipts: z.number().int(),
  transferDate: z.string(),
});

export type StatementLine = z.output<typeof statementLineSchema>;
export type MandantStatement = z.output<typeof mandantStatementSchema>;
