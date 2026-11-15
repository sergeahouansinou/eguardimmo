import { addMonths, monthName, parseDay, toIso, yearMonth } from "@/lib/dates";
import { AVIS_MONTHS_AFTER, AVIS_MONTHS_BEFORE } from "./source";
import { calledMinor, isOperational, mandatState } from "./selectors";
import type { Portefeuille } from "./selectors";
import type { Avis, Bail, Bien, Locataire, Mandant, Mandat } from "./schemas";

export interface AvisLine {
  bail: Bail;
  bien: Bien;
  tenant: Locataire;
  mandant: Mandant;
  mandat: Mandat;
  dueIso: string;
  amountMinor: number;
  avis: Avis | undefined;
}

export function monthLabel(month: string): string {
  const { year } = parseDay(`${month}-01`);
  const name = monthName(`${month}-01`);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${String(year)}`;
}

export function avisMonths(todayIso: string): string[] {
  return Array.from({ length: AVIS_MONTHS_BEFORE + AVIS_MONTHS_AFTER + 1 }, (_, position) => yearMonth(addMonths(todayIso, position - AVIS_MONTHS_BEFORE)));
}

export function defaultAvisMonth(todayIso: string): string {
  return yearMonth(addMonths(todayIso, 1));
}

export function isAvisMonth(todayIso: string, month: string): boolean {
  return avisMonths(todayIso).includes(month);
}

export function dueIsoOf(bail: Bail, month: string): string {
  const { year, month: monthNumber } = parseDay(`${month}-01`);
  return toIso(year, monthNumber, bail.dueDay);
}

export function avisLines(index: Portefeuille, month: string): AvisLine[] {
  const { data } = index;
  return data.baux
    .filter((bail) => bail.status === "en_cours")
    .flatMap((bail): AvisLine[] => {
      const bien = index.bien(bail.bienId);
      const tenant = index.locataire(bail.locataireId);
      const mandat = bien ? index.mandat(bien.mandatId) : undefined;
      const mandant = mandat ? index.mandant(mandat.mandantId) : undefined;
      if (!bien || !tenant || !mandat || !mandant || !isOperational(mandatState(mandat, data.todayIso))) return [];
      const dueIso = dueIsoOf(bail, month);
      if (dueIso < bail.startIso || dueIso > bail.endIso) return [];
      return [{ bail, bien, tenant, mandant, mandat, dueIso, amountMinor: calledMinor(bail), avis: data.avis.find((item) => item.bailId === bail.id && item.month === month) }];
    });
}
