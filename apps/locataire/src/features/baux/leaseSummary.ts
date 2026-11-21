import type { Money, TermView } from '@/tenant/model';
import { sumMoney } from '@/tenant/format';

export type TermGroup = 'rent' | 'charges' | 'deposit';

const SEMANTICS: Record<TermGroup, readonly string[]> = {
  rent: ['rent'],
  charges: ['charges_provision', 'charges_flat'],
  deposit: ['deposit'],
};

export function termTotal(terms: readonly TermView[], group: TermGroup): Money | null {
  const matching = terms.filter((term) => term.semanticKey !== null && SEMANTICS[group].includes(term.semanticKey));
  return sumMoney(matching.map((term) => term.amount));
}

export function rentIndexation(terms: readonly TermView[]): boolean | null {
  const rent = terms.filter((term) => term.semanticKey === 'rent');
  if (rent.length === 0) return null;
  return rent.some((term) => term.indexed);
}
