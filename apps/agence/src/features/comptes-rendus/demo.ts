import { z } from "zod";
import { PAYOUT_DAY } from "@/features/shared/agencyDefaults";
import { DEMO_TODAY, addMonths, formatPeriod } from "@/features/shared/dates";
import { MANDANTS, mandantById } from "@/features/shared/directory";
import { DemoServerError } from "@/features/shared/errors";
import { createStore } from "@/features/shared/store";
import { mandantStatementSchema } from "@/features/shared/statement";
import type { MandantStatement } from "@/features/shared/statement";
import type { FinancesSource } from "../finances/source";
import {
  CURRENT_PERIOD,
  MAX_MONTHS,
  lastDayOf,
  mergeStatements,
  monthsInRange,
  periodKeyOf,
  periodLabelOf,
  periodShortOf,
  receiptsOf,
  remindersOf,
  syntheticStatement,
} from "./compose";
import { defaultOptions, seedRecords } from "./records";
import type { ReportRecord } from "./records";
import { DEFAULT_CONTENT, generateRequestSchema, pdfOptionsInputSchema, rangeSchema } from "./schemas";
import type { MandantPreview, Overview, PeriodKind, ReportDetail, ReportRow, ReportState } from "./schemas";
import type { ComptesRendusSource } from "./source";

export interface ComptesRendusDeps {
  finances: FinancesSource;
}

const statementsSchema = z.array(mandantStatementSchema);

function validate<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  const fieldErrors: Record<string, string> = {};
  parsed.error.issues.forEach((issue) => {
    const field = String(issue.path[0] ?? "");
    if (field && !(field in fieldErrors)) fieldErrors[field] = issue.message;
  });
  throw new DemoServerError("validation", "Les données saisies sont invalides.", fieldErrors);
}

function settle<T>(work: () => Promise<T>): Promise<T> {
  try {
    return work();
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

export function createComptesRendusDemo(deps: ComptesRendusDeps): ComptesRendusSource {
  const records = createStore(seedRecords());

  const monthStatements = async (month: string): Promise<MandantStatement[]> => {
    const parsed = statementsSchema.safeParse(await deps.finances.statements(month));
    if (!parsed.success) throw new DemoServerError("finances", "Les chiffres de gestion sont indisponibles.");
    return parsed.data;
  };

  const statementFor = async (mandantId: string, from: string, to: string, period: string): Promise<MandantStatement | null> => {
    const mandant = mandantById(mandantId);
    if (!mandant) return null;
    const months = monthsInRange(from, to);
    const parts = await Promise.all(
      months.map(async (month) => {
        const found = (await monthStatements(month)).find((statement) => statement.mandantId === mandantId);
        if (found) return found;
        return month < CURRENT_PERIOD ? syntheticStatement(mandant, month) : null;
      }),
    );
    return mergeStatements(
      parts.filter((part): part is MandantStatement => part !== null),
      period,
    );
  };

  const lastSentOf = (mandantId: string) =>
    records
      .get()
      .filter((record) => record.mandantId === mandantId && record.state === "publie" && record.publishedOn)
      .sort((a, b) => (b.publishedOn ?? "").localeCompare(a.publishedOn ?? ""))[0];

  const toRow = (
    mandantId: string,
    statement: MandantStatement,
    kind: PeriodKind,
    from: string,
    to: string,
    state: ReportState,
    id: string,
  ): ReportRow => {
    const lastSent = lastSentOf(mandantId);
    return {
      id,
      mandantId,
      mandantName: statement.mandantName,
      mandantKind: statement.mandantKind,
      periodKey: periodKeyOf(kind, from, to),
      periodLabel: periodLabelOf(kind, from, to),
      periodShort: periodShortOf(kind, from, to),
      state,
      collectedMinor: statement.collectedMinor,
      feeMinor: statement.feeMinor,
      netMinor: statement.netMinor,
      lots: statement.lines.length,
      lastSentOn: lastSent?.publishedOn ?? null,
      lastSentShort: lastSent ? periodShortOf(lastSent.kind, lastSent.from, lastSent.to) : null,
    };
  };

  const overview = async (): Promise<Overview> => {
    const current = await monthStatements(CURRENT_PERIOD);
    const monthStart = `${CURRENT_PERIOD}-01`;
    const monthEnd = lastDayOf(CURRENT_PERIOD);
    const rows: ReportRow[] = [];
    const seen = new Set<string>();
    current.forEach((statement) => {
      const id = `${statement.mandantId}-${CURRENT_PERIOD}`;
      const record = records.get().find((item) => item.id === id);
      seen.add(id);
      rows.push(toRow(statement.mandantId, statement, "mensuel", monthStart, monthEnd, record?.state ?? "a_generer", id));
    });
    const others = records.get().filter((record) => !seen.has(record.id));
    const otherRows = await Promise.all(
      others.map(async (record) => {
        const statement = await statementFor(record.mandantId, record.from, record.to, record.periodKey);
        return statement ? toRow(record.mandantId, statement, record.kind, record.from, record.to, record.state, record.id) : null;
      }),
    );
    otherRows.forEach((row) => {
      if (row) rows.push(row);
    });
    const published = records.get().filter((record) => record.state === "publie" && record.publishedOn);
    const lastOn = published.map((record) => record.publishedOn ?? "").sort().at(-1);
    const lastGroup = published.filter((record) => record.publishedOn === lastOn);
    const first = lastGroup[0];
    return {
      currentPeriod: CURRENT_PERIOD,
      currentPeriodLabel: formatPeriod(CURRENT_PERIOD),
      nextSendOn: `${addMonths(DEMO_TODAY, 1).slice(0, 7)}-${String(PAYOUT_DAY).padStart(2, "0")}`,
      lastSend:
        lastOn && first
          ? {
              on: lastOn,
              periodShort: periodShortOf(first.kind, first.from, first.to),
              count: lastGroup.length,
              read: lastGroup.filter((record) => record.read === true).length,
              unknownReads: lastGroup.every((record) => record.read === null),
            }
          : null,
      rows,
    };
  };

  const detailOf = async (id: string): Promise<ReportDetail | null> => {
    const record = records.get().find((item) => item.id === id);
    const derived = MANDANTS.find((mandant) => id === `${mandant.id}-${CURRENT_PERIOD}`);
    const mandantId = record?.mandantId ?? derived?.id;
    if (!mandantId) return null;
    const from = record?.from ?? `${CURRENT_PERIOD}-01`;
    const to = record?.to ?? lastDayOf(CURRENT_PERIOD);
    const kind = record?.kind ?? "mensuel";
    const statement = await statementFor(mandantId, from, to, record?.periodKey ?? CURRENT_PERIOD);
    if (!statement) return null;
    const content = record?.content ?? [...DEFAULT_CONTENT];
    return {
      id,
      state: record?.state ?? "a_generer",
      kind,
      from,
      to,
      periodLabel: periodLabelOf(kind, from, to),
      content,
      options: record?.options ?? defaultOptions(content),
      publication: record?.publication ?? "planifiee",
      notify: record?.notify ?? true,
      generatedOn: record?.generatedOn ?? null,
      publishedOn: record?.publishedOn ?? null,
      statement,
      receipts: receiptsOf(statement),
      reminders: remindersOf(statement),
    };
  };

  const preview = async (input: unknown): Promise<MandantPreview[]> => {
    const range = validate(rangeSchema, input);
    if (monthsInRange(range.from, range.to).length > MAX_MONTHS) {
      throw new DemoServerError("validation", "Période trop longue.", { to: `La période ne peut pas dépasser ${String(MAX_MONTHS)} mois.` });
    }
    const all = await Promise.all(MANDANTS.map((mandant) => statementFor(mandant.id, range.from, range.to, periodKeyOf("personnalise", range.from, range.to))));
    return all.flatMap((statement) =>
      statement && statement.lines.length > 0
        ? [
            {
              mandantId: statement.mandantId,
              mandantName: statement.mandantName,
              mandantKind: statement.mandantKind,
              lots: statement.lines.length,
              collectedMinor: statement.collectedMinor,
              feeMinor: statement.feeMinor,
              netMinor: statement.netMinor,
              receipts: statement.receipts,
            },
          ]
        : [],
    );
  };

  return {
    list: () => settle(overview),
    preview: (range) => settle(() => preview(range)),
    get: (id) => settle(() => detailOf(id)),
    generate: (request) =>
      settle(async () => {
        const data = validate(generateRequestSchema, request);
        if (data.kind === "mensuel" && data.from.slice(0, 7) !== data.to.slice(0, 7)) {
          throw new DemoServerError("validation", "Période invalide.", { to: "Un compte rendu mensuel couvre un seul mois." });
        }
        if (monthsInRange(data.from, data.to).length > MAX_MONTHS) {
          throw new DemoServerError("validation", "Période trop longue.", { to: `La période ne peut pas dépasser ${String(MAX_MONTHS)} mois.` });
        }
        const periodKey = periodKeyOf(data.kind, data.from, data.to);
        const planned = await Promise.all(
          data.mandantIds.map(async (mandantId) => ({
            mandantId,
            mandant: mandantById(mandantId),
            statement: await statementFor(mandantId, data.from, data.to, periodKey),
          })),
        );
        const missing = planned.filter((item) => !item.mandant || !item.statement || item.statement.lines.length === 0);
        if (missing.length > 0) {
          const names = missing.map((item) => item.mandant?.name ?? item.mandantId).join(", ");
          throw new DemoServerError("validation", "Génération impossible.", { mandantIds: `Aucun encaissement pour ${names} sur cette période.` });
        }
        const locked = planned.filter((item) => records.get().some((record) => record.id === `${item.mandantId}-${periodKey}` && record.state === "publie"));
        if (locked.length > 0) {
          const names = locked.map((item) => item.mandant?.name ?? item.mandantId).join(", ");
          throw new DemoServerError("validation", "Génération impossible.", { mandantIds: `Déjà publié pour ${names} : il ne peut pas être régénéré.` });
        }
        const now = data.publication === "maintenant" && !data.draft;
        const ids = planned.map((item) => `${item.mandantId}-${periodKey}`);
        const created: ReportRecord[] = planned.map((item) => ({
          id: `${item.mandantId}-${periodKey}`,
          mandantId: item.mandantId,
          kind: data.kind,
          from: data.from,
          to: data.to,
          periodKey,
          state: data.draft ? "brouillon" : now ? "publie" : "genere",
          content: data.content,
          options: defaultOptions(data.content),
          publication: data.publication,
          notify: data.notify,
          generatedOn: data.draft ? null : DEMO_TODAY,
          publishedOn: now ? DEMO_TODAY : null,
          read: null,
        }));
        records.update((items) => [...items.filter((item) => !ids.includes(item.id)), ...created]);
        return { ids };
      }),
    setOptions: (input) =>
      settle(() => {
        const data = validate(pdfOptionsInputSchema, input);
        const record = records.get().find((item) => item.id === data.id);
        if (!record) throw new DemoServerError("not_found", "Générez d'abord le compte rendu pour régler ses options.");
        if (record.state === "publie") throw new DemoServerError("locked", "Ce compte rendu est publié : ses options ne peuvent plus changer.");
        records.update((items) =>
          items.map((item) =>
            item.id === data.id ? { ...item, options: { receiptsAttached: data.receiptsAttached, letterhead: data.letterhead, reminderDetail: data.reminderDetail } } : item,
          ),
        );
        return Promise.resolve();
      }),
    publish: (id) =>
      settle(() => {
        const record = records.get().find((item) => item.id === id);
        if (!record) throw new DemoServerError("not_found", "Générez d'abord le compte rendu avant de le publier.");
        if (record.state === "publie") throw new DemoServerError("already_published", "Ce compte rendu est déjà publié.");
        records.update((items) =>
          items.map((item) => (item.id === id ? { ...item, state: "publie", generatedOn: item.generatedOn ?? DEMO_TODAY, publishedOn: DEMO_TODAY, read: null } : item)),
        );
        return Promise.resolve();
      }),
  };
}
