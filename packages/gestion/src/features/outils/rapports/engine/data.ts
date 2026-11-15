import { z } from 'zod';

const month = z.string().regex(/^\d{4}-\d{2}$/);
const minor = z.number().int();

export const reportsDataSchema = z.object({
  generatedAt: z.iso.datetime({ offset: true }),
  today: z.iso.date(),
  lots: z.array(z.object({ id: z.string(), name: z.string(), buildingId: z.string(), buildingName: z.string() })),
  leases: z.array(
    z.object({
      lotId: z.string(),
      reference: z.string(),
      tenantId: z.string(),
      tenantName: z.string(),
      furnished: z.boolean(),
      status: z.enum(['en_cours', 'preavis', 'a_venir']),
      start: z.iso.date(),
      end: z.iso.date(),
      rent: minor,
      charges: minor,
      deposit: minor,
      depositReceivedOn: z.iso.date().nullable(),
      nextRevision: z.iso.date(),
      revisionIndex: z.string(),
    }),
  ),
  payments: z.array(z.object({ lotId: z.string(), month, called: minor, collected: minor })),
  expenses: z.array(
    z.object({
      id: z.string(),
      date: z.iso.date(),
      lotName: z.string(),
      buildingName: z.string(),
      kind: z.string(),
      supplier: z.string(),
      description: z.string(),
      amount: minor,
    }),
  ),
  yearBalances: z.array(
    z.object({
      year: z.number().int(),
      depreciation: minor,
      lines: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          detail: z.string(),
          kind: z.enum(['recette', 'charge']),
          amount: minor,
          missingProofs: z.number().int(),
        }),
      ),
    }),
  ),
  invoices: z.array(
    z.object({
      id: z.string(),
      number: z.string(),
      date: z.iso.date(),
      kind: z.enum(['facture', 'avoir']),
      recipient: z.string(),
      amountHt: minor,
      amountTtc: minor,
      vatPct: z.number(),
    }),
  ),
  occupants: z.array(
    z.object({ tenantId: z.string(), name: z.string(), lotId: z.string(), since: z.iso.date(), email: z.string(), state: z.string() }),
  ),
  assets: z.array(
    z.object({
      lotId: z.string(),
      purchasePrice: minor.nullable(),
      purchaseYear: z.number().int().nullable(),
      fees: minor.nullable(),
      estimatedValue: minor.nullable(),
      estimatedYear: z.number().int().nullable(),
    }),
  ),
  loans: z.array(
    z.object({
      id: z.string(),
      buildingName: z.string(),
      bank: z.string(),
      borrowed: minor,
      rateBp: z.number().int(),
      endMonth: month,
      monthly: minor,
      remaining: minor,
      interestYear: minor,
      status: z.enum(['en_cours', 'rembourse']),
    }),
  ),
  diagnostics: z.array(
    z.object({
      lotId: z.string(),
      label: z.string(),
      doneOn: z.iso.date().nullable(),
      expiresOn: z.iso.date().nullable(),
      status: z.enum(['valide', 'a_refaire', 'expire', 'sans_objet']),
    }),
  ),
  depositReturns: z.array(
    z.object({
      lotId: z.string(),
      number: z.string(),
      tenantName: z.string(),
      deposit: minor,
      returned: minor,
      retained: minor,
      receivedOn: z.iso.date(),
      issuedOn: z.iso.date(),
    }),
  ),
  insurances: z.array(
    z.object({
      lotId: z.string(),
      tenantName: z.string(),
      insurer: z.string(),
      validUntil: z.iso.date().nullable(),
      status: z.enum(['valide', 'expire', 'manquante']),
    }),
  ),
});
export type ReportsData = z.infer<typeof reportsDataSchema>;
