import { addDays, addMonths, monthOf } from '../dates';
import { bailOf, echeanceEtat, isOpen, joursRetard, resteDu } from '../derive';
import type { EcheanceEtat } from '../derive';
import type { Bail, Depense, Echeance, FinancesData, Paiement } from '../schemas';

export const ALL = 'tous';

export interface OperationsFilters {
  from: string;
  to: string;
  search: string;
  proprietaire: string;
  bien: string;
  bail: string;
  etat: string;
}

export function defaultFilters(today: string): OperationsFilters {
  const first = `${monthOf(today)}-01`;
  return { from: first, to: addDays(addMonths(first, 1), -1), search: '', proprietaire: ALL, bien: ALL, bail: ALL, etat: ALL };
}

export const bienLabel = (bail: Pick<Bail, 'unite' | 'immeuble'>): string => `${bail.unite}, ${bail.immeuble}`;

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const matches = (haystack: string, needle: string) => needle.trim() === '' || fold(haystack).includes(fold(needle.trim()));

export interface EcheanceRow {
  echeance: Echeance;
  bail: Bail;
  etat: EcheanceEtat;
  reste: number;
  jours: number;
}

export function echeanceRows(data: FinancesData, filters: OperationsFilters, direction: 'asc' | 'desc'): EcheanceRow[] {
  const rows: EcheanceRow[] = [];
  for (const echeance of data.echeances) {
    const bail = bailOf(data, echeance.bailId);
    if (!bail || !isOpen(echeance)) continue;
    const etat = echeanceEtat(echeance, data.today);
    const keep =
      echeance.echeance >= filters.from &&
      echeance.echeance <= filters.to &&
      matches(`${bail.locataire} ${bienLabel(bail)}`, filters.search) &&
      (filters.proprietaire === ALL || bail.proprietaire === filters.proprietaire) &&
      (filters.bien === ALL || bienLabel(bail) === filters.bien) &&
      (filters.bail === ALL || bail.numero === filters.bail) &&
      (filters.etat === ALL || etat === filters.etat);
    if (keep) rows.push({ echeance, bail, etat, reste: resteDu(echeance), jours: joursRetard(echeance, data.today) });
  }
  const sign = direction === 'asc' ? 1 : -1;
  return rows.sort((a, b) => sign * a.echeance.echeance.localeCompare(b.echeance.echeance) || b.reste - a.reste);
}

export interface PaiementRow {
  paiement: Paiement;
  bail: Bail;
}

export function paiementRows(data: FinancesData, filters: OperationsFilters): PaiementRow[] {
  const rows: PaiementRow[] = [];
  for (const paiement of data.paiements) {
    const bail = bailOf(data, paiement.bailId);
    if (!bail || !paiement.comptabilise) continue;
    const keep =
      paiement.date >= filters.from &&
      paiement.date <= filters.to &&
      matches(`${bail.locataire} ${bienLabel(bail)}`, filters.search) &&
      (filters.proprietaire === ALL || bail.proprietaire === filters.proprietaire) &&
      (filters.bien === ALL || bienLabel(bail) === filters.bien) &&
      (filters.bail === ALL || bail.numero === filters.bail);
    if (keep) rows.push({ paiement, bail });
  }
  return rows.sort((a, b) => b.paiement.date.localeCompare(a.paiement.date));
}

export function depenseRows(data: FinancesData, filters: OperationsFilters): Depense[] {
  return data.depenses
    .filter(
      (depense) =>
        depense.date >= filters.from &&
        depense.date <= filters.to &&
        matches(`${depense.bien} ${depense.fournisseur} ${depense.description}`, filters.search) &&
        (filters.bien === ALL || depense.bien === filters.bien),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function filterOptions(data: FinancesData) {
  const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, 'fr'));
  return {
    proprietaires: unique(data.baux.map((bail) => bail.proprietaire)),
    biens: unique([...data.baux.map(bienLabel), ...data.depenses.map((depense) => depense.bien)]),
    baux: data.baux.map((bail) => bail.numero).sort(),
  };
}
