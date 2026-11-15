import { addDays, monthOf } from '../dates';
import { bailOf, dossierTotals, impayes, joursRetard, resteDu } from '../derive';
import { dossierOfEcheance } from '../recouvrement/creances';
import type { Bail, Echeance, FinancesData } from '../schemas';

export const ALL = 'tous';
export const OLD_THRESHOLD = 15;
export const AGE_MONTH = 30;
export const AGE_TWO_MONTHS = 60;

export interface ImpayeRow {
  echeance: Echeance;
  bail: Bail;
  jours: number;
  reste: number;
  derniere: string | null;
  etape: string;
  miseEnDemeureDue: boolean;
  dossierId: string | null;
  resteAEtaler: number;
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function prochaineEtape(data: FinancesData, echeance: Echeance, formatDate: (iso: string) => string): { label: string; miseEnDemeureDue: boolean } {
  const jours = joursRetard(echeance, data.today);
  const relances = data.relances.filter((relance) => relance.echeanceId === echeance.id && relance.amiable).map((relance) => relance.date).sort();
  const derniere = relances[relances.length - 1];
  const hasFormalNotice = data.relances.some((relance) => relance.echeanceId === echeance.id && relance.canal === 'recommande');
  if (hasFormalNotice) return { label: 'Commandement de payer à préparer', miseEnDemeureDue: false };
  if (!derniere) return { label: 'Première relance à envoyer', miseEnDemeureDue: false };
  if (jours >= OLD_THRESHOLD) return { label: 'Mise en demeure à envoyer', miseEnDemeureDue: true };
  if (relances.length === 1 && jours < 10) return { label: `Deuxième relance le ${formatDate(addDays(derniere, 5))}`, miseEnDemeureDue: false };
  return { label: `Mise en demeure le ${formatDate(addDays(echeance.echeance, OLD_THRESHOLD))}`, miseEnDemeureDue: false };
}

export interface ImpayeFilters {
  age: 'tous' | 'moins30' | 'de30a60' | 'plus60';
  search: string;
  immeuble: string;
  proprietaire: string;
  miseEnDemeure: boolean;
}

export const defaultImpayeFilters: ImpayeFilters = { age: 'tous', search: '', immeuble: ALL, proprietaire: ALL, miseEnDemeure: false };

export function allImpayeRows(data: FinancesData, formatDate: (iso: string) => string): ImpayeRow[] {
  const rows: ImpayeRow[] = [];
  for (const echeance of impayes(data)) {
    const bail = bailOf(data, echeance.bailId);
    if (!bail) continue;
    const relances = data.relances.filter((relance) => relance.echeanceId === echeance.id && relance.amiable).map((relance) => relance.date).sort();
    const etape = prochaineEtape(data, echeance, formatDate);
    const dossier = dossierOfEcheance(data, echeance.id);
    rows.push({
      echeance,
      bail,
      jours: joursRetard(echeance, data.today),
      reste: resteDu(echeance),
      derniere: relances[relances.length - 1] ?? null,
      etape: etape.label,
      miseEnDemeureDue: etape.miseEnDemeureDue,
      dossierId: dossier?.id ?? null,
      resteAEtaler: dossier ? dossierTotals(data, dossier).dette : resteDu(echeance),
    });
  }
  return rows;
}

export const matchesAge = (jours: number, age: ImpayeFilters['age']): boolean => {
  if (age === 'moins30') return jours < AGE_MONTH;
  if (age === 'de30a60') return jours >= AGE_MONTH && jours <= AGE_TWO_MONTHS;
  if (age === 'plus60') return jours > AGE_TWO_MONTHS;
  return true;
};

export function filterImpayes(rows: readonly ImpayeRow[], filters: ImpayeFilters): ImpayeRow[] {
  const needle = fold(filters.search.trim());
  return rows.filter(
    (row) =>
      matchesAge(row.jours, filters.age) &&
      (filters.immeuble === ALL || row.bail.immeuble === filters.immeuble) &&
      (needle === '' || fold(`${row.bail.locataire} ${row.bail.unite} ${row.bail.immeuble}`).includes(needle)) &&
      (filters.proprietaire === ALL || row.bail.proprietaire === filters.proprietaire) &&
      (!filters.miseEnDemeure || row.miseEnDemeureDue),
  );
}

export const remindersOfMonth = (data: FinancesData): { total: number; recommandes: number } => {
  const month = monthOf(data.today);
  const relances = data.relances.filter((relance) => monthOf(relance.date) === month);
  return { total: relances.length, recommandes: relances.filter((relance) => relance.canal === 'recommande').length };
};
