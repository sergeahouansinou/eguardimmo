import type { Facture, FinancesData } from '../schemas';

export type FactureTab = 'toutes' | 'payees' | 'attente' | 'avoirs';

export interface FactureFilters {
  tab: FactureTab;
  search: string;
  year: string;
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const inTab = (facture: Facture, tab: FactureTab): boolean => {
  if (tab === 'payees') return facture.type === 'facture' && facture.statut === 'payee';
  if (tab === 'attente') return facture.type === 'facture' && facture.statut === 'attente';
  if (tab === 'avoirs') return facture.type === 'avoir';
  return true;
};

export function factureYears(data: FinancesData): string[] {
  return [...new Set(data.factures.map((facture) => facture.date.slice(0, 4)))].sort().reverse();
}

export function filterFactures(data: FinancesData, filters: FactureFilters): Facture[] {
  const needle = fold(filters.search.trim());
  return data.factures
    .filter(
      (facture) =>
        inTab(facture, filters.tab) &&
        facture.date.startsWith(filters.year) &&
        (needle === '' || fold(`${facture.numero} ${facture.destinataire} ${facture.objet}`).includes(needle)),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.numero.localeCompare(a.numero));
}
