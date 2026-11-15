import { createDemoFinances } from '../demo';
import type { FinancesData } from '../schemas';

export function demoWithRenewalLease(): FinancesData {
  const data = createDemoFinances();
  data.baux.push({ id: 'bl-2026-0018', numero: 'BL-2026-0018', locataireId: 'awa-traore', locataire: 'Awa Traoré', unite: 'Apt A3', immeuble: 'Les Tilleuls', proprietaire: 'Awa Diallo' });
  return data;
}

export const IBRAHIM_ECHEANCE = 'ech-2026-11-ibrahim-yao';
export const IBRAHIM_FACTURE = 'fa-2026-0022';

export function demoWithOverdueInvoice(): FinancesData {
  const data = createDemoFinances();
  const facture = data.factures.find((item) => item.id === IBRAHIM_FACTURE);
  if (!facture) throw new Error('Facture de démonstration absente.');
  facture.echeance = '2026-11-05';
  return data;
}
