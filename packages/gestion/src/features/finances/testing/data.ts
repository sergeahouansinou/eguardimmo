import { createDemoFinances } from '../demo';
import type { FinancesData } from '../schemas';

export function demoWithRenewalLease(): FinancesData {
  const data = createDemoFinances();
  data.baux.push({ id: 'bl-2026-0018', numero: 'BL-2026-0018', locataireId: 'awa-traore', locataire: 'Awa Traoré', unite: 'Apt A3', immeuble: 'Les Tilleuls', proprietaire: 'Awa Diallo' });
  return data;
}
