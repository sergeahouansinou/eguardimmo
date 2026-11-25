import { z } from "zod";
import { dataSchema, listSchema, moneySchema, pageSchema } from "@/features/org/schemas";

export const JOURNALS = ["rent", "bank", "fees", "deposits", "recovery", "adjustments", "purchases"] as const;
export type Journal = (typeof JOURNALS)[number];

const journalSchema = z.enum(JOURNALS);
const sideSchema = z.enum(["debit", "credit"]);
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const accountApi = z.object({
  id: z.string().min(1),
  code: z.string(),
  label: z.string(),
  role: z.string(),
  normal_side: sideSchema,
  balances: z.array(moneySchema),
});

export const accountSchema = accountApi.transform((account) => ({
  id: account.id,
  code: account.code,
  label: account.label,
  role: account.role,
  normalSide: account.normal_side,
  balances: account.balances,
}));
export type Account = z.output<typeof accountSchema>;

const entryBase = {
  id: z.string().min(1),
  reference: z.string(),
  fiscal_year: z.number().int(),
  number: z.number().int(),
  journal: journalSchema,
  entry_date: isoDay,
  label: z.string(),
  source: z.object({ type: z.string(), id: z.string().nullable() }),
  reversal_of_id: z.string().nullable(),
  posted_at: z.string(),
};

const lineApi = z.object({
  id: z.string().min(1),
  position: z.number().int(),
  account: z.object({ id: z.string(), code: z.string(), role: z.string(), label: z.string() }),
  debit: moneySchema,
  credit: moneySchema,
  lease_id: z.string().nullable(),
  party_id: z.string().nullable(),
  unit_id: z.string().nullable(),
  item: z.object({ type: z.string(), id: z.string() }).nullable(),
});

export const entryLineSchema = lineApi.transform((line) => ({
  id: line.id,
  position: line.position,
  account: line.account,
  debit: line.debit,
  credit: line.credit,
  leaseId: line.lease_id,
  partyId: line.party_id,
  unitId: line.unit_id,
}));
export type EntryLine = z.output<typeof entryLineSchema>;

function toEntry(entry: z.output<z.ZodObject<typeof entryBase>>) {
  return {
    id: entry.id,
    reference: entry.reference,
    fiscalYear: entry.fiscal_year,
    number: entry.number,
    journal: entry.journal,
    date: entry.entry_date,
    label: entry.label,
    sourceType: entry.source.type,
    reversalOfId: entry.reversal_of_id,
    postedAt: entry.posted_at,
  };
}

export const entrySummarySchema = z.object({ ...entryBase, lines_count: z.number().int().nonnegative().optional() }).transform((entry) => ({ ...toEntry(entry), linesCount: entry.lines_count ?? null }));
export type EntrySummary = z.output<typeof entrySummarySchema>;

export const entryDetailSchema = z.object({ ...entryBase, lines: z.array(lineApi) }).transform((entry) => ({ ...toEntry(entry), lines: entry.lines.map((line) => entryLineSchema.parse(line)) }));
export type EntryDetail = z.output<typeof entryDetailSchema>;

export const statementSchema = z
  .object({
    lease_id: z.string(),
    from: isoDay,
    to: isoDay,
    opening_balance: moneySchema,
    lines: z.array(
      z.object({
        entry_id: z.string(),
        reference: z.string(),
        date: isoDay,
        journal: journalSchema,
        label: z.string(),
        debit: moneySchema,
        credit: moneySchema,
        balance: moneySchema,
      }),
    ),
    closing_balance: moneySchema,
  })
  .transform((statement) => ({
    leaseId: statement.lease_id,
    from: statement.from,
    to: statement.to,
    opening: statement.opening_balance,
    closing: statement.closing_balance,
    lines: statement.lines.map((line) => ({ entryId: line.entry_id, reference: line.reference, date: line.date, journal: line.journal, label: line.label, debit: line.debit, credit: line.credit, balance: line.balance })),
  }));
export type LeaseStatement = z.output<typeof statementSchema>;
export type StatementLine = LeaseStatement["lines"][number];

export const leaseOptionSchema = z
  .object({
    id: z.string().min(1),
    reference: z.string(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    main_unit: z.object({ reference: z.string() }).nullable(),
    tenants: z.array(z.object({ display_name: z.string() })),
  })
  .transform((lease) => ({
    id: lease.id,
    reference: lease.reference,
    currency: lease.currency,
    label: [lease.reference, lease.main_unit?.reference, lease.tenants.map((tenant) => tenant.display_name).join(", ")].filter((part) => part !== undefined && part !== "").join(" · "),
  }));
export type LeaseOption = z.output<typeof leaseOptionSchema>;

export const accountsResponse = listSchema(accountSchema);
export const entriesResponse = pageSchema(entrySummarySchema);
export const entryResponse = dataSchema(entryDetailSchema);
export const statementResponse = dataSchema(statementSchema);
export const leasesResponse = pageSchema(leaseOptionSchema);

export interface EntryFilters {
  journal?: Journal;
  lease?: string;
  from?: string;
  to?: string;
}

export interface StatementInput {
  lease: string;
  currency: string;
  from: string;
  to: string;
}
