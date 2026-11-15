import { z } from "zod";

export const BUG_AREAS = ["finances", "biens", "locataires", "baux", "documents", "messages", "rapports", "compte", "autre"] as const;
export type BugArea = (typeof BUG_AREAS)[number];

export const BUG_AREA_LABELS: Record<BugArea, string> = {
  finances: "Finances et loyers",
  biens: "Biens et immeubles",
  locataires: "Locataires",
  baux: "Baux",
  documents: "Documents et quittances",
  messages: "Messages et campagnes",
  rapports: "Rapports et analytique",
  compte: "Compte et réglages",
  autre: "Autre",
};

export const BUG_SEVERITIES = ["bloquant", "genant", "mineur"] as const;
export type BugSeverity = (typeof BUG_SEVERITIES)[number];

export const BUG_SEVERITY_LABELS: Record<BugSeverity, string> = {
  bloquant: "Bloquant : je ne peux plus travailler",
  genant: "Gênant : il existe un contournement",
  mineur: "Mineur : défaut d’affichage ou de texte",
};

export const SUBJECT_PREFIX = "[Problème] ";

export const bugReportSchema = z.object({
  area: z.enum(BUG_AREAS),
  severity: z.enum(BUG_SEVERITIES),
  summary: z.string().trim().min(5, "Résumez le problème en quelques mots").max(120, "120 caractères au maximum"),
  steps: z.string().trim().min(10, "Décrivez les étapes pour reproduire le problème").max(2000, "2 000 caractères au maximum"),
  expected: z.string().trim().max(1000, "1 000 caractères au maximum"),
});
export type BugReport = z.infer<typeof bugReportSchema>;
export const BUG_FIELDS = ["area", "severity", "summary", "steps", "expected"] as const satisfies readonly (keyof BugReport)[];

export const EMPTY_BUG_REPORT: BugReport = { area: "autre", severity: "genant", summary: "", steps: "", expected: "" };

export function bugReportToTicket(report: BugReport): { subject: string; body: string } {
  const lines = [
    `Zone : ${BUG_AREA_LABELS[report.area]}`,
    `Gravité : ${BUG_SEVERITY_LABELS[report.severity]}`,
    "",
    "Étapes pour reproduire :",
    report.steps,
  ];
  if (report.expected.length > 0) lines.push("", "Résultat attendu :", report.expected);
  return { subject: `${SUBJECT_PREFIX}${report.summary}`, body: lines.join("\n") };
}

export const changelogEntrySchema = z.object({
  id: z.string().min(1),
  date: z.iso.date(),
  title: z.string().min(1),
  summary: z.string().min(1),
  kind: z.enum(["nouveau", "amelioration", "correctif"]),
  href: z.string().startsWith("/").optional(),
});
export type ChangelogEntry = z.infer<typeof changelogEntrySchema>;
export const changelogSchema = z.array(changelogEntrySchema);
