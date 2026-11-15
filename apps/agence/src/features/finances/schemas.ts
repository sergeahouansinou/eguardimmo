import { z } from "zod";

const money = z.number().int();
const tone = z.enum(["neutral", "info", "success", "warning", "danger"]);
const mode = z.enum(["virement", "cheque", "prelevement", "especes"]);
const paymentStatus = z.enum(["recu", "a_rapprocher", "rejete"]);

export const paymentRowSchema = z.object({
  id: z.string(),
  lotId: z.string(),
  lotLabel: z.string(),
  tenantName: z.string(),
  mandantId: z.string(),
  mandantName: z.string(),
  installmentLabel: z.string(),
  installmentCalledMinor: money,
  receivedOn: z.string(),
  mode,
  reference: z.string(),
  note: z.string(),
  amountMinor: money,
  feeMinor: money,
  status: paymentStatus,
  receipt: z.boolean(),
  rejectionReason: z.string().nullable(),
});

export const encaissementsSchema = z.object({
  period: z.string(),
  periodLabel: z.string(),
  periods: z.array(z.object({ value: z.string(), label: z.string() })),
  calledMinor: money,
  collectedMinor: money,
  feeMinor: money,
  remainingMinor: money,
  unpaidCount: z.number().int(),
  rateLabel: z.string(),
  payments: z.array(paymentRowSchema),
  mandants: z.array(z.object({ value: z.string(), label: z.string() })),
});

export const openInstallmentSchema = z.object({
  installmentId: z.string(),
  lotId: z.string(),
  lotLabel: z.string(),
  tenantName: z.string(),
  mandantId: z.string(),
  mandantName: z.string(),
  label: z.string(),
  dueOn: z.string(),
  calledMinor: money,
  remainingMinor: money,
});

export const openInstallmentsSchema = z.array(openInstallmentSchema);

export const paymentPreviewSchema = z.object({
  error: z.string().nullable(),
  remainingAfterMinor: money,
  feeMinor: money,
  netMinor: money,
  mandantName: z.string(),
  lotLabel: z.string(),
  closesCase: z.boolean(),
});

const nextStepSchema = z.object({ label: z.string(), dueOn: z.string().nullable(), urgent: z.boolean(), recommendation: z.string() });

export const unpaidRowSchema = z.object({
  lotId: z.string(),
  lotLabel: z.string(),
  tenantName: z.string(),
  mandantId: z.string(),
  mandantName: z.string(),
  dueOn: z.string(),
  remainingMinor: money,
  overdueDays: z.number().int(),
  lastReminderOn: z.string().nullable(),
  reminders: z.number().int(),
  nextStep: nextStepSchema,
});

export const impayesSchema = z.object({
  totalMinor: money,
  mandantsCount: z.number().int(),
  over20Minor: money,
  over20Label: z.string(),
  remindersThisMonth: z.number().int(),
  remindersCases: z.number().int(),
  rows: z.array(unpaidRowSchema),
  mandants: z.array(z.object({ value: z.string(), label: z.string() })),
});

export const caseEventSchema = z.object({
  id: z.string(),
  kind: z.enum(["echeance", "relance", "appel", "mandant", "message", "mise_en_demeure", "echeancier", "paiement", "rejet"]),
  date: z.string(),
  title: z.string(),
  detail: z.string(),
  badge: z.object({ label: z.string(), tone }).nullable(),
  planned: z.boolean(),
});

export const impayeDetailSchema = z.object({
  lotId: z.string(),
  lotLabel: z.string(),
  address: z.string(),
  tenantName: z.string(),
  mandantId: z.string(),
  mandantName: z.string(),
  mandantKind: z.string(),
  installmentLabel: z.string(),
  dueOn: z.string(),
  calledMinor: money,
  remainingMinor: money,
  rentMinor: money,
  chargesMinor: money,
  depositMinor: money,
  pendingFeeMinor: money,
  overdueDays: z.number().int(),
  reminders: z.number().int(),
  lastReminderOn: z.string().nullable(),
  nextStep: nextStepSchema,
  events: z.array(caseEventSchema),
  plan: z.object({ proposedOn: z.string(), lines: z.array(z.object({ dueOn: z.string(), amountMinor: money })) }).nullable(),
  noticeOn: z.string().nullable(),
  impact: z.object({ lotsLabel: z.string(), rateBp: z.number().int(), collectedMinor: money, feeMinor: money, netMinor: money }),
});

export const reversementStatusSchema = z.enum(["a_reverser", "reverse", "bloque"]);

export const reversementRowSchema = z.object({
  mandantId: z.string(),
  name: z.string(),
  kind: z.string(),
  mandateRenewal: z.boolean(),
  lots: z.number().int(),
  collectedMinor: money,
  feeMinor: money,
  netMinor: money,
  ibanLast4: z.string(),
  scheduledOn: z.string(),
  status: reversementStatusSchema,
  blockedReason: z.string().nullable(),
});

export const historyRowSchema = z.object({
  id: z.string(),
  mandantId: z.string(),
  name: z.string(),
  kind: z.string(),
  mandateRenewal: z.boolean(),
  period: z.string(),
  paidOn: z.string(),
  lots: z.number().int(),
  collectedMinor: money,
  feeMinor: money,
  netMinor: money,
  ibanLast4: z.string(),
});

export const reversementsSchema = z.object({
  period: z.string(),
  executionOn: z.string(),
  rateLabel: z.string(),
  rows: z.array(reversementRowSchema),
  history: z.array(historyRowSchema),
  unpaid: z.object({ count: z.number().int(), totalMinor: money, labels: z.array(z.string()) }),
  lastBatch: z.object({ executedOn: z.string(), periodLabel: z.string(), count: z.number().int(), executed: z.boolean() }).nullable(),
  batchStatus: z.enum(["brouillon", "valide"]).nullable(),
});

export const lotSchema = z
  .object({
    id: z.string(),
    period: z.string(),
    status: z.enum(["brouillon", "valide"]),
    executionOn: z.string(),
    validatedAt: z.string().nullable(),
    transfers: z.array(
      z.object({
        mandantId: z.string(),
        name: z.string(),
        kind: z.string(),
        ibanLast4: z.string(),
        label: z.string(),
        netMinor: money,
        mandateRenewal: z.boolean(),
      }),
    ),
    lotsCount: z.number().int(),
    totalMinor: money,
    feesMinor: money,
    collectedMinor: money,
    retainedMinor: money,
    excluded: z.array(z.object({ mandantId: z.string(), name: z.string(), reason: z.string(), canInclude: z.boolean() })),
    accountLast4: z.string(),
  })
  .nullable();

export const reversementDetailSchema = z
  .object({
    mandantId: z.string(),
    name: z.string(),
    kind: z.string(),
    mateRef: z.string(),
    ibanLast4: z.string(),
    period: z.string(),
    status: reversementStatusSchema,
    scheduledOn: z.string(),
    blockedReason: z.string().nullable(),
    inBatch: z.boolean(),
    batchStatus: z.enum(["brouillon", "valide"]).nullable(),
    rateBp: z.number().int(),
    calledMinor: money,
    collectedMinor: money,
    feeMinor: money,
    htMinor: money,
    vatMinor: money,
    worksMinor: money,
    netMinor: money,
    pendingFeeMinor: money,
    lines: z.array(
      z.object({
        lotId: z.string(),
        lotLabel: z.string(),
        lotDescription: z.string(),
        tenantName: z.string(),
        paidOn: z.string().nullable(),
        calledMinor: money,
        collectedMinor: money,
        feeMinor: money,
        netMinor: money,
      }),
    ),
    unpaidLabels: z.array(z.string()),
    history: z.array(z.object({ id: z.string(), period: z.string(), paidOn: z.string(), feeMinor: money, netMinor: money })),
  })
  .nullable();

export const honorairesSchema = z.object({
  period: z.string(),
  label: z.string(),
  periods: z.array(z.object({ value: z.string(), label: z.string() })),
  rows: z.array(
    z.object({
      mandantId: z.string(),
      name: z.string(),
      kind: z.string(),
      mateRef: z.string(),
      rateBp: z.number().int(),
      collectedMinor: money,
      feeMinor: money,
      htMinor: money,
      vatMinor: money,
      pendingMinor: money,
      retention: z.string(),
    }),
  ),
  collectedMinor: money,
  feeMinor: money,
  htMinor: money,
  vatMinor: money,
  pendingMinor: money,
  unpaidCount: z.number().int(),
  lotsCount: z.number().int(),
  mandantsCount: z.number().int(),
  scheme: z.object({
    rateLabel: z.string(),
    baseLabel: z.string(),
    collectionLabel: z.string(),
    sameRateCount: z.number().int(),
    totalMandants: z.number().int(),
    upcoming: z.array(z.object({ mandantName: z.string(), rateBp: z.number().int(), effectiveFrom: z.string() })),
  }),
});

export const baremesSchema = z.array(
  z.object({
    mandantId: z.string(),
    name: z.string(),
    label: z.string(),
    lots: z.number().int(),
    monthlyMinor: money,
    current: z.object({
      rateBp: z.number().int(),
      base: z.enum(["encaisses", "hors_charges"]),
      minFeeMinor: money,
      collection: z.enum(["reversement", "encaissement"]),
      relocationPercent: z.number(),
      worksBp: z.number().int(),
    }),
  }),
);

export const simulationSchema = z.object({
  collectedMinor: money,
  currentRateBp: z.number().int(),
  currentFeeMinor: money,
  newFeeMinor: money,
  differenceMinor: money,
});

export type PaymentRow = z.output<typeof paymentRowSchema>;
export type Encaissements = z.output<typeof encaissementsSchema>;
export type OpenInstallment = z.output<typeof openInstallmentSchema>;
export type PaymentPreview = z.output<typeof paymentPreviewSchema>;
export type UnpaidRow = z.output<typeof unpaidRowSchema>;
export type Impayes = z.output<typeof impayesSchema>;
export type ImpayeDetail = z.output<typeof impayeDetailSchema>;
export type ReversementRow = z.output<typeof reversementRowSchema>;
export type HistoryRow = z.output<typeof historyRowSchema>;
export type Reversements = z.output<typeof reversementsSchema>;
export type TransferLot = NonNullable<z.output<typeof lotSchema>>;
export type ReversementDetail = NonNullable<z.output<typeof reversementDetailSchema>>;
export type Honoraires = z.output<typeof honorairesSchema>;
export type Baremes = z.output<typeof baremesSchema>;
export type Simulation = z.output<typeof simulationSchema>;
