import { addDays, monthOf } from '../dates';
import { bailOf, impayes, joursRetard, resteDu } from '../derive';
import type { Bail, Echeance, FinancesData } from '../schemas';

export const ALL = 'tous';
export const OLD_THRESHOLD = 15;
export const VERY_OLD_THRESHOLD = 20;

export interface ImpayeRow {
  echeance: Echeance;
  bail: Bail;
  jours: number;
  reste: number;
  derniere: string | null;
  etape: string;
  miseEnDemeureDue: boolean;
  dossierId: string | null;
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
  age: 'tous' | 'recent' | 'ancien';
  search: string;
  proprietaire: string;
  miseEnDemeure: boolean;
}

export const defaultImpayeFilters: ImpayeFilters = { age: 'tous', search: '', proprietaire: ALL, miseEnDemeure: false };

export function allImpayeRows(data: FinancesData, formatDate: (iso: string) => string): ImpayeRow[] {
  const rows: ImpayeRow[] = [];
  for (const echeance of impayes(data)) {
    const bail = bailOf(data, echeance.bailId);
    if (!bail) continue;
    const relances = data.relances.filter((relance) => relance.echeanceId === echeance.id && relance.amiable).map((relance) => relance.date).sort();
    const etape = prochaineEtape(data, echeance, formatDate);
    rows.push({
      echeance,
      bail,
      jours: joursRetard(echeance, data.today),
      reste: resteDu(echeance),
      derniere: relances[relances.length - 1] ?? null,
      etape: etape.label,
      miseEnDemeureDue: etape.miseEnDemeureDue,
      dossierId: data.dossiers.find((dossier) => dossier.echeanceId === echeance.id)?.id ?? null,
    });
  }
  return rows;
}

export function filterImpayes(rows: readonly ImpayeRow[], filters: ImpayeFilters): ImpayeRow[] {
  const needle = fold(filters.search.trim());
  return rows.filter(
    (row) =>
      (filters.age === 'tous' || (filters.age === 'recent' ? row.jours < OLD_THRESHOLD : row.jours >= OLD_THRESHOLD)) &&
      (needle === '' || fold(`${row.bail.locataire} ${row.bail.unite} ${row.bail.immeuble}`).includes(needle)) &&
      (filters.proprietaire === ALL || row.bail.proprietaire === filters.proprietaire) &&
      (!filters.miseEnDemeure || row.miseEnDemeureDue),
  );
}

export const remindersOfMonth = (data: FinancesData): { total: number; dossiers: number } => {
  const month = monthOf(data.today);
  const relances = data.relances.filter((relance) => monthOf(relance.date) === month);
  return { total: relances.length, dossiers: new Set(relances.map((relance) => relance.echeanceId)).size };
};
