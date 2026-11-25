import { OrgApiError, invalidInput } from "@/features/org/errors";
import type { Page } from "@/features/org/schemas";
import { DEMO_LEASES, balancesOf, buildDemoEntries } from "./demoLedger";
import type { ComptabiliteSource } from "./source";
import type { EntryDetail, EntryFilters, EntrySummary, LeaseStatement, StatementLine } from "./schemas";

export const DEMO_ENTRIES_PER_PAGE = 15;
const STATEMENT_LINES_MAX = 200;

function summaryOf(entry: EntryDetail): EntrySummary {
  const { lines, ...rest } = entry;
  return { ...rest, linesCount: lines.length };
}

function matches(entry: EntryDetail, filters: EntryFilters): boolean {
  if (filters.journal !== undefined && entry.journal !== filters.journal) return false;
  if (filters.lease !== undefined && !entry.lines.some((line) => line.leaseId === filters.lease)) return false;
  if (filters.from !== undefined && entry.date < filters.from) return false;
  if (filters.to !== undefined && entry.date > filters.to) return false;
  return true;
}

function newestFirst(entries: readonly EntryDetail[]): EntryDetail[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

export function createDemoComptabilite(): ComptabiliteSource {
  const entries = buildDemoEntries();
  const ordered = newestFirst(entries);
  return {
    accounts: () => Promise.resolve(balancesOf(entries)),
    entries: (filters, cursor): Promise<Page<EntrySummary>> => {
      const start = cursor === null ? 0 : Number(cursor);
      if (!Number.isInteger(start) || start < 0) return Promise.reject(invalidInput("Curseur invalide.", "cursor"));
      const matching = ordered.filter((entry) => matches(entry, filters));
      const slice = matching.slice(start, start + DEMO_ENTRIES_PER_PAGE);
      const next = start + DEMO_ENTRIES_PER_PAGE;
      return Promise.resolve({ items: slice.map(summaryOf), nextCursor: next < matching.length ? String(next) : null });
    },
    entry: (id) => {
      const found = entries.find((entry) => entry.id === id);
      return found === undefined ? Promise.reject(new OrgApiError("not_found", "Cette écriture n’existe pas ou n’appartient pas à votre organisation.", { status: 404, code: "entry_not_found" })) : Promise.resolve(found);
    },
    leases: () => Promise.resolve([...DEMO_LEASES]),
    statement: (input): Promise<LeaseStatement> => {
      if (!DEMO_LEASES.some((lease) => lease.id === input.lease)) return Promise.reject(new OrgApiError("not_found", "Ce bail n’existe pas ou n’appartient pas à votre organisation.", { status: 404 }));
      if (input.currency !== "EUR") return Promise.resolve({ leaseId: input.lease, from: input.from, to: input.to, opening: { amount: 0, currency: input.currency }, closing: { amount: 0, currency: input.currency }, lines: [] });
      const movements = newestFirst(entries)
        .reverse()
        .flatMap((entry) => entry.lines.filter((line) => line.leaseId === input.lease && line.account.role === "tenant_receivable").map((line) => ({ entry, line })));
      let running = 0;
      let opening = 0;
      const lines: StatementLine[] = [];
      for (const { entry, line } of movements) {
        running += line.debit.amount - line.credit.amount;
        if (entry.date < input.from) {
          opening = running;
          continue;
        }
        if (entry.date > input.to) continue;
        lines.push({ entryId: entry.id, reference: entry.reference, date: entry.date, journal: entry.journal, label: entry.label, debit: line.debit, credit: line.credit, balance: { amount: running, currency: "EUR" } });
      }
      if (lines.length > STATEMENT_LINES_MAX) return Promise.reject(new OrgApiError("invalid", "Ce relevé dépasse le nombre de lignes affichables : réduisez la période.", { status: 422, code: "statement_too_long" }));
      const closing = lines.length === 0 ? opening : (lines[lines.length - 1]?.balance.amount ?? opening);
      return Promise.resolve({ leaseId: input.lease, from: input.from, to: input.to, opening: { amount: opening, currency: "EUR" }, closing: { amount: closing, currency: "EUR" }, lines });
    },
  };
}

let shared: ComptabiliteSource | null = null;

export function demoComptabilite(): ComptabiliteSource {
  shared ??= createDemoComptabilite();
  return shared;
}
