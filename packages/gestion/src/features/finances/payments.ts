import { bailOf, isOpen, resteDu } from './derive';
import type { Bail, Echeance, FinancesData } from './schemas';

export interface TenantOption {
  bail: Bail;
  echeances: Echeance[];
}

export function openByBail(data: FinancesData): TenantOption[] {
  return data.baux
    .map((bail) => ({
      bail,
      echeances: data.echeances.filter((echeance) => echeance.bailId === bail.id && isOpen(echeance) && resteDu(echeance) > 0).sort((a, b) => a.echeance.localeCompare(b.echeance)),
    }))
    .filter((option) => option.echeances.length > 0);
}

export function defaultEcheance(data: FinancesData, requestedId: string | null): { echeance: Echeance | null; missing: boolean } {
  if (requestedId) {
    const echeance = data.echeances.find((item) => item.id === requestedId);
    return echeance?.statut === 'active' && bailOf(data, echeance.bailId) ? { echeance, missing: false } : { echeance: null, missing: true };
  }
  const today = data.today;
  const overdue = data.echeances
    .filter((item) => item.statut === 'active' && resteDu(item) > 0 && item.echeance <= today)
    .sort((a, b) => a.echeance.localeCompare(b.echeance) || resteDu(b) - resteDu(a))[0];
  return { echeance: overdue ?? null, missing: false };
}

export function outcomeAfter(echeance: Echeance | null, montant: number): { reste: number; credit: number } {
  if (!echeance) return { reste: 0, credit: 0 };
  const reste = echeance.montant - echeance.paye - montant;
  return { reste: Math.max(0, reste), credit: Math.max(0, -reste) };
}
