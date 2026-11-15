import { addMonths } from "@/features/shared/dates";
import { MANDANTS } from "@/features/shared/directory";
import { lastDayOf } from "./compose";
import { DEFAULT_CONTENT } from "./schemas";
import type { ContentKey, PdfOptions, PeriodKind } from "./schemas";

export interface ReportRecord {
  id: string;
  mandantId: string;
  kind: PeriodKind;
  from: string;
  to: string;
  periodKey: string;
  state: "brouillon" | "genere" | "publie";
  content: ContentKey[];
  options: PdfOptions;
  publication: "planifiee" | "maintenant";
  notify: boolean;
  generatedOn: string | null;
  publishedOn: string | null;
  read: boolean | null;
}

export const HISTORY_MONTHS = ["2026-07", "2026-08", "2026-09", "2026-10"] as const;

export function defaultOptions(content: readonly ContentKey[]): PdfOptions {
  return { receiptsAttached: content.includes("quittances"), letterhead: true, reminderDetail: false };
}

export function seedRecords(): ReportRecord[] {
  const history = HISTORY_MONTHS.flatMap((month) =>
    MANDANTS.map<ReportRecord>((mandant) => ({
      id: `${mandant.id}-${month}`,
      mandantId: mandant.id,
      kind: "mensuel",
      from: `${month}-01`,
      to: lastDayOf(month),
      periodKey: month,
      state: "publie",
      content: [...DEFAULT_CONTENT],
      options: defaultOptions(DEFAULT_CONTENT),
      publication: "planifiee",
      notify: true,
      generatedOn: `${addMonths(`${month}-01`, 1).slice(0, 7)}-02`,
      publishedOn: `${addMonths(`${month}-01`, 1).slice(0, 7)}-05`,
      read: !(month === "2026-10" && mandant.id === "paul-lemoine"),
    })),
  );
  const draft: ReportRecord = {
    id: "marc-chevalier-2026-11",
    mandantId: "marc-chevalier",
    kind: "mensuel",
    from: "2026-11-01",
    to: "2026-11-30",
    periodKey: "2026-11",
    state: "brouillon",
    content: [...DEFAULT_CONTENT],
    options: defaultOptions(DEFAULT_CONTENT),
    publication: "planifiee",
    notify: true,
    generatedOn: null,
    publishedOn: null,
    read: null,
  };
  return [...history, draft];
}
