import type { Account, EntryDetail, EntryLine, Journal, LeaseOption } from "./schemas";

const EUR = "EUR";

export const DEMO_LEASES: readonly LeaseOption[] = [
  { id: "b-2024-018", reference: "B-2024-018", currency: EUR, label: "B-2024-018 · Apt 12 · Thomas Girard" },
  { id: "b-2026-007", reference: "B-2026-007", currency: EUR, label: "B-2026-007 · Studio 4 · Anaïs Roux" },
  { id: "b-2025-009", reference: "B-2025-009", currency: EUR, label: "B-2025-009 · Apt 3 · Julie Marchand" },
];

interface AccountSeed {
  id: string;
  code: string;
  label: string;
  role: string;
  normalSide: "debit" | "credit";
}

const ACCOUNT_SEEDS: readonly AccountSeed[] = [
  { id: "compte-1000", code: "1000", label: "Banque", role: "bank", normalSide: "debit" },
  { id: "compte-1010", code: "1010", label: "Banque, compte de tiers (fonds des mandants)", role: "trust_bank", normalSide: "debit" },
  { id: "compte-2000", code: "2000", label: "Créances locataires", role: "tenant_receivable", normalSide: "debit" },
  { id: "compte-3000", code: "3000", label: "Dettes envers les propriétaires et mandants", role: "owner_payable", normalSide: "credit" },
  { id: "compte-3010", code: "3010", label: "Loyers appelés pour le compte des mandants, non encaissés", role: "owner_rent_called", normalSide: "credit" },
  { id: "compte-3020", code: "3020", label: "Charges appelées pour le compte des mandants, non encaissées", role: "owner_charges_called", normalSide: "credit" },
  { id: "compte-3200", code: "3200", label: "TVA collectée", role: "vat_collected", normalSide: "credit" },
  { id: "compte-4200", code: "4200", label: "Honoraires", role: "fee_revenue", normalSide: "credit" },
];

const ACCOUNT_BY_ROLE = new Map(ACCOUNT_SEEDS.map((seed) => [seed.role, seed]));

interface LeaseSeed {
  id: string;
  rent: number;
  charges: number;
  paymentDay: number;
  unpaidMonths: readonly string[];
}

const LEASE_SEEDS: readonly LeaseSeed[] = [
  { id: "b-2024-018", rent: 64_000, charges: 6_000, paymentDay: 3, unpaidMonths: [] },
  { id: "b-2026-007", rent: 40_000, charges: 5_000, paymentDay: 2, unpaidMonths: ["2026-11"] },
  { id: "b-2025-009", rent: 136_000, charges: 12_000, paymentDay: 4, unpaidMonths: [] },
];

const MONTHS = ["2026-09", "2026-10", "2026-11"] as const;
const FEE_BASIS_POINTS = 800;
const VAT_BASIS_POINTS = 2_000;

interface LineSeed {
  role: string;
  side: "debit" | "credit";
  amount: number;
  lease?: string;
}

interface EntrySeed {
  key: string;
  date: string;
  journal: Journal;
  label: string;
  sourceType: string;
  lines: readonly LineSeed[];
  reversalOf?: string;
}

function ratio(amount: number, basisPoints: number): number {
  return Math.round((amount * basisPoints) / 10_000);
}

function monthSeeds(lease: LeaseSeed, month: string, reference: string, name: string): EntrySeed[] {
  const total = lease.rent + lease.charges;
  const seeds: EntrySeed[] = [
    {
      key: `appel-${lease.id}-${month}`,
      date: `${month}-01`,
      journal: "rent",
      label: `Appel de loyer ${month}, ${name} (${reference})`,
      sourceType: "installment",
      lines: [
        { role: "tenant_receivable", side: "debit", amount: total, lease: lease.id },
        { role: "owner_rent_called", side: "credit", amount: lease.rent, lease: lease.id },
        { role: "owner_charges_called", side: "credit", amount: lease.charges, lease: lease.id },
      ],
    },
  ];
  if (lease.unpaidMonths.includes(month)) return seeds;
  const fee = ratio(lease.rent, FEE_BASIS_POINTS);
  const vat = ratio(fee, VAT_BASIS_POINTS);
  seeds.push(
    {
      key: `paiement-${lease.id}-${month}`,
      date: `${month}-${String(lease.paymentDay).padStart(2, "0")}`,
      journal: "bank",
      label: `Paiement du loyer ${month}, ${name} (${reference})`,
      sourceType: "payment",
      lines: [
        { role: "trust_bank", side: "debit", amount: total, lease: lease.id },
        { role: "tenant_receivable", side: "credit", amount: total, lease: lease.id },
      ],
    },
    {
      key: `honoraires-${lease.id}-${month}`,
      date: `${month}-${String(lease.paymentDay).padStart(2, "0")}`,
      journal: "fees",
      label: `Honoraires de gestion ${month}, ${name} (${reference})`,
      sourceType: "fee_settlement",
      lines: [
        { role: "owner_payable", side: "debit", amount: fee + vat, lease: lease.id },
        { role: "fee_revenue", side: "credit", amount: fee, lease: lease.id },
        { role: "vat_collected", side: "credit", amount: vat, lease: lease.id },
      ],
    },
  );
  return seeds;
}

function duplicatePair(): EntrySeed[] {
  const lease = LEASE_SEEDS[2];
  if (lease === undefined) return [];
  const total = lease.rent + lease.charges;
  const lines: readonly LineSeed[] = [
    { role: "tenant_receivable", side: "debit", amount: total, lease: lease.id },
    { role: "owner_rent_called", side: "credit", amount: lease.rent, lease: lease.id },
    { role: "owner_charges_called", side: "credit", amount: lease.charges, lease: lease.id },
  ];
  return [
    { key: "doublon-b-2025-009", date: "2026-10-02", journal: "rent", label: "Appel de loyer 2026-10 en double, Julie Marchand (B-2025-009)", sourceType: "installment", lines },
    {
      key: "contre-passation-b-2025-009",
      date: "2026-10-06",
      journal: "adjustments",
      label: "Contre-passation de l’appel en double 2026-10, Julie Marchand (B-2025-009)",
      sourceType: "adjustment",
      reversalOf: "doublon-b-2025-009",
      lines: lines.map((line) => ({ ...line, side: line.side === "debit" ? "credit" : "debit" })),
    },
  ];
}

const NAMES: Readonly<Record<string, string>> = { "b-2024-018": "Thomas Girard", "b-2026-007": "Anaïs Roux", "b-2025-009": "Julie Marchand" };

function allSeeds(): EntrySeed[] {
  const seeds = LEASE_SEEDS.flatMap((lease) => MONTHS.flatMap((month) => monthSeeds(lease, month, lease.id.toUpperCase(), NAMES[lease.id] ?? lease.id)));
  return [...seeds, ...duplicatePair()].sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
}

function zero(): { amount: number; currency: string } {
  return { amount: 0, currency: EUR };
}

export function buildDemoEntries(): EntryDetail[] {
  const seeds = allSeeds();
  const idOf = new Map(seeds.map((seed, index) => [seed.key, `ecriture-2026-${String(index + 1).padStart(6, "0")}`]));
  return seeds.map((seed, index): EntryDetail => {
    const number = index + 1;
    const lines = seed.lines.map((line, position): EntryLine => {
      const account = ACCOUNT_BY_ROLE.get(line.role);
      if (account === undefined) throw new Error(`Compte de démonstration absent : ${line.role}`);
      const amount = { amount: line.amount, currency: EUR };
      return {
        id: `${idOf.get(seed.key) ?? seed.key}-ligne-${String(position + 1)}`,
        position: position + 1,
        account: { id: account.id, code: account.code, role: account.role, label: account.label },
        debit: line.side === "debit" ? amount : zero(),
        credit: line.side === "credit" ? amount : zero(),
        leaseId: line.lease ?? null,
        partyId: null,
        unitId: null,
      };
    });
    return {
      id: idOf.get(seed.key) ?? seed.key,
      reference: `2026-${String(number).padStart(6, "0")}`,
      fiscalYear: 2026,
      number,
      journal: seed.journal,
      date: seed.date,
      label: seed.label,
      sourceType: seed.sourceType,
      reversalOfId: seed.reversalOf === undefined ? null : (idOf.get(seed.reversalOf) ?? null),
      postedAt: `${seed.date}T08:30:00+00:00`,
      lines,
    };
  });
}

export function balancesOf(entries: readonly EntryDetail[]): Account[] {
  return ACCOUNT_SEEDS.map((seed) => {
    let debit = 0;
    let credit = 0;
    for (const entry of entries) {
      for (const line of entry.lines) {
        if (line.account.id !== seed.id) continue;
        debit += line.debit.amount;
        credit += line.credit.amount;
      }
    }
    const balance = seed.normalSide === "debit" ? debit - credit : credit - debit;
    return { id: seed.id, code: seed.code, label: seed.label, role: seed.role, normalSide: seed.normalSide, balances: debit === 0 && credit === 0 ? [] : [{ amount: balance, currency: EUR }] };
  });
}
