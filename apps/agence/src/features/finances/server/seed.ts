import { DEFAULT_FEE_BASIS_POINTS } from "@/features/shared/agencyDefaults";
import { addMonths, formatDate } from "@/features/shared/dates";
import { CURRENT_USER, LOTS, MANDANTS, lotById, tenantById } from "@/features/shared/directory";
import { applyRate, formatMoney, sum } from "@/features/shared/money";
import { DEFAULT_HISTORY_MONTHS, HISTORY_MONTHS, NOVEMBER_DUE_DATES, NOVEMBER_PAYMENTS } from "./seedData";
import { CURRENT_PERIOD } from "./model";
import type { CaseEvent, FinancesState, Installment, Payment, PaymentMode, ReversementRecord, UnpaidCase } from "./model";

const MODE_PREFIX: Record<PaymentMode, string> = { virement: "VIR", cheque: "CHQ", prelevement: "PRLV", especes: "ESP" };

function referenceOf(lotId: string, mode: PaymentMode, receivedOn: string): string {
  const lot = lotById(lotId);
  const tenant = lot ? tenantById(lot.tenantId) : undefined;
  const lastName = (tenant?.name.split(" ").at(-1) ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  const day = formatDate(receivedOn).slice(0, 5);
  return `${MODE_PREFIX[mode]} ${day} ${lastName} ${(lot?.label ?? lotId).toUpperCase()}`;
}

function buildInstallments(): Installment[] {
  return LOTS.flatMap((lot) =>
    [
      { period: "2026-10", dueOn: "2026-10-01" },
      { period: CURRENT_PERIOD, dueOn: NOVEMBER_DUE_DATES[lot.id] ?? "2026-11-01" },
    ].map(({ period, dueOn }) => ({
      id: `${lot.id}-${period}`,
      lotId: lot.id,
      period,
      dueOn,
      calledMinor: lot.rentMinor + lot.chargesMinor,
      rentMinor: lot.rentMinor,
      chargesMinor: lot.chargesMinor,
    })),
  );
}

function paymentOf(id: string, installment: Installment, receivedOn: string, mode: PaymentMode, status: Payment["status"]): Payment {
  return {
    id,
    installmentId: installment.id,
    lotId: installment.lotId,
    receivedOn,
    mode,
    reference: referenceOf(installment.lotId, mode, receivedOn),
    note: "",
    amountMinor: installment.calledMinor,
    feeMinor: applyRate(installment.calledMinor, DEFAULT_FEE_BASIS_POINTS),
    status,
    receipt: true,
    notifyTenant: true,
    notifyMandant: false,
    rejectionReason: null,
  };
}

function buildPayments(installments: readonly Installment[]): Payment[] {
  const byId = new Map(installments.map((installment) => [installment.id, installment]));
  const november = NOVEMBER_PAYMENTS.flatMap((seed) => {
    const installment = byId.get(`${seed.lotId}-${CURRENT_PERIOD}`);
    return installment ? [paymentOf(`pay-nov-${seed.lotId}`, installment, seed.receivedOn, seed.mode, seed.status)] : [];
  });
  const october = LOTS.flatMap((lot, index) => {
    const installment = byId.get(`${lot.id}-2026-10`);
    const novemberMode = NOVEMBER_PAYMENTS.find((seed) => seed.lotId === lot.id)?.mode;
    const mode: PaymentMode = novemberMode === "prelevement" ? "prelevement" : "virement";
    const day = String(2 + (index % 5)).padStart(2, "0");
    return installment ? [paymentOf(`pay-oct-${lot.id}`, installment, `2026-10-${day}`, mode, "recu")] : [];
  });
  return [...november, ...october];
}

function event(id: string, kind: CaseEvent["kind"], date: string, title: string, detail: string, badge: CaseEvent["badge"] = null): CaseEvent {
  return { id, kind, date, title, detail, badge };
}

const RELANCE_1 = { label: "Relance 1", tone: "neutral" } as const;
const RELANCE_2 = { label: "Relance 2", tone: "neutral" } as const;
const UNPAID = { label: "Impayé", tone: "danger" } as const;

function buildCases(): UnpaidCase[] {
  const studio = lotById("studio-4");
  const apt7 = lotById("apt-7");
  const lot3 = lotById("lot-3");
  if (!studio || !apt7 || !lot3) return [];
  const called = (lot: { rentMinor: number; chargesMinor: number }) => `${formatMoney(lot.rentMinor + lot.chargesMinor)} appelés`;
  return [
    {
      lotId: "studio-4",
      status: "ouvert",
      plan: null,
      noticeOn: null,
      events: [
        event("evt-s4-1", "echeance", "2026-11-01", "Échéance de novembre non réglée", called(studio), UNPAID),
        event("evt-s4-2", "relance", "2026-11-04", "Rappel amiable par e-mail", `lu le jour même · ${CURRENT_USER.name}`, RELANCE_1),
        event("evt-s4-3", "appel", "2026-11-06", "Appel téléphonique", "sans réponse, message laissé"),
        event("evt-s4-4", "relance", "2026-11-10", "Deuxième relance, grand livre joint", "e-mail et SMS", RELANCE_2),
        event("evt-s4-5", "mandant", "2026-11-10", "Mandant informé", "Marc Chevalier, via son espace"),
        event("evt-s4-6", "message", "2026-11-12", "Message du locataire", "« Je règle le 15/11 »", { label: "À répondre", tone: "warning" }),
      ],
    },
    {
      lotId: "apt-7",
      status: "ouvert",
      plan: null,
      noticeOn: null,
      events: [
        event("evt-a7-1", "echeance", "2026-10-19", "Échéance de novembre non réglée", called(apt7), UNPAID),
        event("evt-a7-2", "relance", "2026-11-02", "Rappel amiable par e-mail", `lu le 03/11 · ${CURRENT_USER.name}`, RELANCE_1),
        event("evt-a7-3", "appel", "2026-11-05", "Appel téléphonique", "sans réponse, message laissé"),
        event("evt-a7-4", "relance", "2026-11-10", "Deuxième relance, grand livre joint", "e-mail et SMS", RELANCE_2),
        event("evt-a7-5", "mandant", "2026-11-10", "Mandant informé", "Famille Bernard, via son espace"),
      ],
    },
    {
      lotId: "lot-3",
      status: "ouvert",
      plan: null,
      noticeOn: null,
      events: [
        event("evt-l3-1", "echeance", "2026-11-05", "Échéance de novembre non réglée", called(lot3), UNPAID),
        event("evt-l3-2", "relance", "2026-11-11", "Rappel amiable par e-mail", CURRENT_USER.name, RELANCE_1),
      ],
    },
  ];
}

function buildRecords(): ReversementRecord[] {
  return MANDANTS.flatMap((mandant) => {
    const months = HISTORY_MONTHS[mandant.id] ?? DEFAULT_HISTORY_MONTHS;
    const lots = LOTS.filter((lot) => lot.mandantId === mandant.id);
    const collectedMinor = sum(lots.map((lot) => lot.rentMinor + lot.chargesMinor));
    const feeMinor = sum(lots.map((lot) => applyRate(lot.rentMinor + lot.chargesMinor, DEFAULT_FEE_BASIS_POINTS)));
    return Array.from({ length: months }, (_, offset) => {
      const period = addMonths("2026-10-01", -offset).slice(0, 7);
      return {
        id: `rev-${mandant.id}-${period}`,
        mandantId: mandant.id,
        period,
        paidOn: `${addMonths(`${period}-01`, 1).slice(0, 7)}-05`,
        lots: lots.length,
        collectedMinor,
        feeMinor,
        netMinor: collectedMinor - feeMinor,
      };
    });
  });
}

export function createInitialState(): FinancesState {
  const installments = buildInstallments();
  return {
    installments,
    payments: buildPayments(installments),
    schemes: MANDANTS.map((mandant) => ({
      id: `bareme-${mandant.id}-1`,
      mandantId: mandant.id,
      rateBp: DEFAULT_FEE_BASIS_POINTS,
      base: "rent_and_charges",
      minFeeMinor: 0,
      lettingBp: 5000,
      worksBp: 500,
      effectiveFrom: "2025-01-01",
      status: "en_vigueur",
    })),
    amendments: [],
    cases: buildCases(),
    records: buildRecords(),
    batches: [],
    blocks: [],
    sequence: 1000,
  };
}
