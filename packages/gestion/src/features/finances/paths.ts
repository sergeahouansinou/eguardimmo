import { createDemoFinances } from './demo';

export const financesPaths = {
  operations: '/finances',
  impayes: '/finances/impayes',
  dossier: (dossierId: string) => `/finances/recouvrement/${dossierId}`,
  impaye: (echeanceId: string) => `/finances/impayes/${echeanceId}`,
  grandLivre: (echeanceId: string) => `/finances/impayes/${echeanceId}/grand-livre`,
  relance: (echeanceId: string, niveau?: 'amiable' | 'seconde' | 'mise_en_demeure') => `/finances/impayes/${echeanceId}/relance${niveau ? `?niveau=${niveau}` : ''}`,
  factures: '/finances/factures',
  nouvelleFacture: '/finances/factures/nouvelle',
  facture: (id: string) => `/finances/factures/${id}`,
  recu: (id: string) => `/finances/recus/${id}`,
  regularisation: '/finances/regularisation',
  bilan: '/finances/bilan',
  prets: '/finances/prets',
  importBancaire: '/finances/import-bancaire',
  encaisser: '/finances/encaissements/nouveau',
  acompte: '/finances/encaissements/acompte',
  depense: '/finances/depenses/nouvelle',
};

export function financesStaticIds(): { echeances: string[]; factures: string[]; recus: string[]; dossiers: string[] } {
  const data = createDemoFinances();
  return {
    echeances: data.echeances.map((echeance) => echeance.id),
    factures: data.factures.map((facture) => facture.id),
    recus: data.recus.map((recu) => recu.id),
    dossiers: data.dossiers.map((dossier) => dossier.id),
  };
}
