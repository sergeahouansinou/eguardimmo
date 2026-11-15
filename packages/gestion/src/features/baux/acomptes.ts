import type { Echeance, FinancesData, Paiement } from '../finances/schemas';

export type AcompteImputation =
  | { kind: 'echeance'; libelle: string; resteDu: number }
  | { kind: 'credit' }
  | { kind: 'depot' }
  | { kind: 'non_comptabilise' };

export interface AcompteEntry {
  id: string;
  date: string;
  nature: Paiement['nature'];
  mode: Paiement['mode'];
  montant: number;
  imputation: AcompteImputation;
  recuId: string | null;
  recuNumero: string | null;
  enAttenteDeSolde: boolean;
}

export interface LeaseAcomptes {
  bailId: string | null;
  entries: AcompteEntry[];
  available: number;
  pending: number;
}

const resteDuOf = (echeance: Echeance): number => echeance.montant - echeance.paye;
const isAcompte = (paiement: Paiement): boolean => paiement.nature === 'acompte_loyer' || paiement.nature === 'acompte_depot' || paiement.recuId !== null;

export function leaseAcomptes(data: FinancesData, leaseReference: string): LeaseAcomptes {
  const bail = data.baux.find((entry) => entry.numero === leaseReference);
  if (!bail) return { bailId: null, entries: [], available: 0, pending: 0 };
  const echeances = data.echeances.filter((entry) => entry.bailId === bail.id);
  const payments = data.paiements.filter((entry) => entry.bailId === bail.id);

  const entries = payments
    .filter(isAcompte)
    .map((paiement): AcompteEntry => {
      const echeance = paiement.echeanceId ? echeances.find((entry) => entry.id === paiement.echeanceId) : undefined;
      const recu = paiement.recuId ? data.recus.find((entry) => entry.id === paiement.recuId) : undefined;
      let imputation: AcompteImputation = { kind: 'credit' };
      if (!paiement.comptabilise) imputation = { kind: 'non_comptabilise' };
      else if (echeance) imputation = { kind: 'echeance', libelle: echeance.libelle, resteDu: Math.max(0, resteDuOf(echeance)) };
      else if (paiement.nature === 'acompte_depot') imputation = { kind: 'depot' };
      return {
        id: paiement.id,
        date: paiement.date,
        nature: paiement.nature,
        mode: paiement.mode,
        montant: paiement.montant,
        imputation,
        recuId: recu?.id ?? null,
        recuNumero: recu?.numero ?? null,
        enAttenteDeSolde: recu !== undefined && imputation.kind === 'echeance' && imputation.resteDu > 0,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));

  const surplus = echeances.filter((entry) => entry.statut === 'active').reduce((sum, entry) => sum + Math.max(0, -resteDuOf(entry)), 0);
  const unattached = payments
    .filter((entry) => entry.comptabilise && entry.nature === 'acompte_loyer' && entry.echeanceId === null)
    .reduce((sum, entry) => sum + entry.montant, 0);

  return {
    bailId: bail.id,
    entries,
    available: surplus + unattached,
    pending: entries.filter((entry) => entry.enAttenteDeSolde).length,
  };
}
