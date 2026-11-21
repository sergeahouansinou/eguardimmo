import type { Money, UnpaidItem } from './model';

export type Selection = { ok: true; leaseId: string; leaseReference: string | null; partyId: string; partyName: string | null; total: Money; installmentIds: string[]; invoiceIds: string[] } | { ok: false; reason: string };

export function groupSelection(items: readonly UnpaidItem[]): Selection {
  const [first] = items;
  if (first === undefined) return { ok: false, reason: 'Sélectionnez au moins une créance.' };
  if (first.partyId === null) return { ok: false, reason: 'Le locataire débiteur de cette créance est inconnu : elle ne peut pas être mise en recouvrement.' };
  const sameDebtor = items.every((item) => item.leaseId === first.leaseId && item.partyId === first.partyId);
  if (!sameDebtor) return { ok: false, reason: 'Les créances d’un même dossier concernent le même bail et le même locataire : ajustez la sélection.' };
  if (!items.every((item) => item.outstanding.currency === first.outstanding.currency)) return { ok: false, reason: 'Les créances sélectionnées n’ont pas la même devise.' };
  return {
    ok: true,
    leaseId: first.leaseId,
    leaseReference: first.leaseReference,
    partyId: first.partyId,
    partyName: first.partyName,
    total: { amount: items.reduce((sum, item) => sum + item.outstanding.amount, 0), currency: first.outstanding.currency },
    installmentIds: items.filter((item) => item.type === 'installment').map((item) => item.itemId),
    invoiceIds: items.filter((item) => item.type === 'invoice').map((item) => item.itemId),
  };
}
