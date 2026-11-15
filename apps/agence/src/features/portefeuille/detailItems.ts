import { addDays, addMonths, daysBetween, formatDay, monthName, parseDay, toIso } from "@/lib/dates";
import type { Portefeuille } from "./selectors";
import type { ActivityEvent, Bail, Bien, EventKind, Mandant, Mandat } from "./schemas";

export interface DocumentItem {
  id: string;
  title: string;
  meta: string;
  badge?: string;
}

export function mandatDocuments(mandat: Mandat): DocumentItem[] {
  return [
    { id: "mandat", title: "Mandat de gestion signé", meta: `PDF · signé électroniquement le ${formatDay(mandat.startIso)}` },
    { id: "garantie", title: "Attestation de garantie financière", meta: `Valable jusqu'au ${formatDay(mandat.guaranteeUntilIso)}` },
    { id: "rcp", title: "Attestation d'assurance RCP", meta: "Valable jusqu'au 31/12/2026" },
  ];
}

export function mandantDocuments(mandant: Mandant, mandat: Mandat | undefined): DocumentItem[] {
  return [
    ...(mandat ? [{ id: "mandat", title: "Mandat de gestion signé", meta: `PDF · signé le ${formatDay(mandat.startIso)}` }] : []),
    { id: "cr", title: "Compte rendu de gestion, 3e trimestre 2026", meta: "PDF · envoyé le 05/10/2026" },
    { id: "identite", title: "Pièce d'identité", meta: `Vérifiée le ${formatDay(mandant.sinceIso)}, numéro masqué` },
    { id: "rib", title: "Relevé d'identité bancaire", meta: `IBAN •••• ${mandant.ibanLast4}` },
  ];
}

export function bailDocuments(bail: Bail): DocumentItem[] {
  return [
    { id: "bail", title: "Bail signé", meta: `PDF · signé électroniquement le ${formatDay(addDays(bail.startIso, -10))}`, badge: "Partagé" },
    { id: "edl", title: "État des lieux d'entrée", meta: `PDF · ${formatDay(bail.startIso)} · 36 photos`, badge: "Partagé" },
    { id: "assurance", title: "Attestation d'assurance habitation", meta: `Valable jusqu'au ${formatDay(bail.endIso)}` },
    { id: "dpe", title: "Diagnostic de performance énergétique", meta: "PDF · annexe au bail", badge: "Partagé" },
    { id: "reglement", title: "Extrait du règlement de copropriété", meta: "PDF · annexe au bail" },
    { id: "depot", title: "Reçu du dépôt de garantie", meta: `PDF · reçu le ${formatDay(bail.startIso)}` },
  ];
}

export function locataireDocuments(index: Portefeuille, locataireId: string): DocumentItem[] {
  const bail = index.currentBailOf(locataireId);
  const start = bail ? formatDay(bail.startIso) : "—";
  const end = bail ? formatDay(bail.endIso) : "—";
  return [
    { id: "identite", title: "Pièce d'identité", meta: `Vérifiée le ${start}, numéro masqué` },
    { id: "revenus", title: "Justificatifs de revenus", meta: "Contrat de travail et 3 bulletins" },
    { id: "assurance", title: "Attestation d'assurance", meta: `À renouveler le ${end}` },
    { id: "bail", title: "Bail signé", meta: `PDF · signé le ${start}` },
    { id: "rib", title: "Relevé d'identité bancaire", meta: `IBAN •••• ${index.locataire(locataireId)?.bankLast4 ?? "—"}` },
  ];
}

export function bienDocuments(bien: Bien): DocumentItem[] {
  return [
    { id: "dpe", title: "Diagnostic de performance énergétique", meta: `DPE ${bien.dpe}` },
    { id: "electricite", title: "Diagnostic électricité et gaz", meta: "PDF · valable 6 ans" },
    { id: "reglement", title: "Règlement de copropriété", meta: `PDF · ${bien.syndic}` },
    { id: "pno", title: "Attestation d'assurance PNO", meta: `Valable jusqu'au ${formatDay(bien.pnoUntilIso)}` },
    { id: "taxe", title: "Avis de taxe foncière", meta: bien.propertyTax },
    { id: "plan", title: "Plan du lot", meta: `PDF · ${String(bien.surfaceM2)} m²` },
  ];
}

export interface UpcomingAction {
  id: string;
  title: string;
  meta: string;
  badge: string;
}

export function bailActions(bail: Bail, todayIso: string): UpcomingAction[] {
  const { year, month } = parseDay(todayIso);
  const deadline = toIso(year, month, 25);
  const days = daysBetween(todayIso, deadline);
  return [
    {
      id: "avis",
      title: `Émettre l'avis de ${monthName(addMonths(todayIso, 1))}`,
      meta: `Avant le ${formatDay(deadline)}`,
      badge: days >= 0 ? `Dans ${String(days)} j` : "En retard",
    },
    { id: "charges", title: `Régulariser les charges ${String(year)}`, meta: `Avant le 15/03/${String(year + 1)}`, badge: "Mars" },
    {
      id: "assurance",
      title: "Renouveler l'attestation d'assurance",
      meta: `Valable jusqu'au ${formatDay(bail.endIso)}`,
      badge: monthName(bail.endIso).replace(/^./, (letter) => letter.toUpperCase()),
    },
  ];
}

const byDateDesc = (a: ActivityEvent, b: ActivityEvent) => (a.dateIso < b.dateIso ? 1 : a.dateIso > b.dateIso ? -1 : a.id.localeCompare(b.id));

function baseline(index: Portefeuille, kind: EventKind, subjectId: string): ActivityEvent | undefined {
  const dateIso =
    kind === "mandat" ? index.mandat(subjectId)?.startIso : kind === "bail" ? index.bail(subjectId)?.startIso : kind === "mandant" ? index.mandant(subjectId)?.sinceIso : undefined;
  if (!dateIso) return undefined;
  const title = kind === "mandat" ? "Mandat signé" : kind === "bail" ? "Bail signé" : "Mandant enregistré";
  return { id: `${kind}-${subjectId}-base`, kind, subjectId, dateIso, title, detail: "Signature électronique", tone: "neutral" };
}

export function eventsFor(index: Portefeuille, kind: EventKind, subjectId: string): ActivityEvent[] {
  const explicit = index.data.events.filter((event) => event.kind === kind && event.subjectId === subjectId);
  const base = baseline(index, kind, subjectId);
  const all = base && !explicit.some((event) => event.title === base.title) ? [...explicit, base] : explicit;
  return all.sort(byDateDesc);
}
