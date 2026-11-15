import { MODE_LABELS } from './labels';
import type { Bail, FinancesData } from './schemas';

export type LivreKind = 'echeance' | 'facture' | 'paiement' | 'avoir';

export interface LivreLine {
  id: string;
  date: string;
  kind: LivreKind;
  piece: string;
  libelle: string;
  bien: string;
  debit: number;
  credit: number;
  solde: number;
}

export interface GrandLivre {
  locataireId: string;
  locataire: string;
  baux: Bail[];
  lignes: LivreLine[];
  totalDebit: number;
  totalCredit: number;
  solde: number;
}

type Draft = Omit<LivreLine, 'solde'>;

const KIND_ORDER: Record<LivreKind, number> = { echeance: 0, facture: 1, avoir: 2, paiement: 3 };

export function grandLivreOf(data: FinancesData, locataireId: string, bailId: string | null = null): GrandLivre | undefined {
  const allBaux = data.baux.filter((bail) => bail.locataireId === locataireId);
  const first = allBaux[0];
  if (!first) return undefined;
  const baux = bailId === null ? allBaux : allBaux.filter((bail) => bail.id === bailId);
  const ids = new Set(baux.map((bail) => bail.id));
  const bienOf = (id: string | null) => {
    const bail = id ? allBaux.find((item) => item.id === id) : undefined;
    return bail ? `${bail.unite}, ${bail.immeuble}` : '';
  };
  const drafts: Draft[] = [];

  for (const echeance of data.echeances) {
    if (!ids.has(echeance.bailId) || echeance.statut === 'annulee') continue;
    drafts.push({
      id: echeance.id,
      date: echeance.echeance,
      kind: 'echeance',
      piece: 'Appel',
      libelle: echeance.statut === 'irrecouvrable' ? `${echeance.libelle} (irrécouvrable)` : echeance.libelle,
      bien: bienOf(echeance.bailId),
      debit: echeance.montant,
      credit: 0,
    });
  }
  for (const paiement of data.paiements) {
    if (!ids.has(paiement.bailId)) continue;
    drafts.push({
      id: paiement.id,
      date: paiement.date,
      kind: 'paiement',
      piece: MODE_LABELS[paiement.mode],
      libelle: paiement.libelle,
      bien: bienOf(paiement.bailId),
      debit: 0,
      credit: paiement.montant,
    });
  }
  for (const facture of data.factures) {
    if (facture.locataireId !== locataireId || (facture.bailId !== null && !ids.has(facture.bailId))) continue;
    if (bailId !== null && facture.bailId === null) continue;
    if (facture.type === 'avoir') {
      drafts.push({ id: facture.id, date: facture.date, kind: 'avoir', piece: facture.numero, libelle: facture.objet, bien: bienOf(facture.bailId), debit: 0, credit: -facture.montantTtc });
      continue;
    }
    drafts.push({ id: facture.id, date: facture.date, kind: 'facture', piece: facture.numero, libelle: facture.objet, bien: bienOf(facture.bailId), debit: facture.montantTtc, credit: 0 });
    if (facture.statut === 'payee' && facture.payeLe) {
      drafts.push({ id: `${facture.id}-reglement`, date: facture.payeLe, kind: 'paiement', piece: `Règlement ${facture.numero}`, libelle: facture.objet, bien: bienOf(facture.bailId), debit: 0, credit: facture.montantTtc });
    }
  }

  drafts.sort((a, b) => a.date.localeCompare(b.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.id.localeCompare(b.id));
  let running = 0;
  const lignes = drafts.map((draft) => {
    running += draft.debit - draft.credit;
    return { ...draft, solde: running };
  });
  return {
    locataireId,
    locataire: first.locataire,
    baux: allBaux,
    lignes,
    totalDebit: lignes.reduce((total, ligne) => total + ligne.debit, 0),
    totalCredit: lignes.reduce((total, ligne) => total + ligne.credit, 0),
    solde: running,
  };
}
