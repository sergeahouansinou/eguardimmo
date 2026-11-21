'use client';

import type { SelectOption } from '@eguardimmo/ui';
import { usePropertyChoices, useTerms } from '../hooks';

export function usePropertyLabels() {
  const properties = usePropertyChoices();
  const options: SelectOption[] = (properties.data ?? []).map((property) => ({ value: property.id, label: property.name }));
  const nameOf = (id: string): string => properties.data?.find((property) => property.id === id)?.name ?? (properties.isPending ? '…' : 'Bien non listé');
  return { query: properties, options, nameOf };
}

export function useTermLabels(vocabulary: 'expense_category' | 'charge_rubric') {
  const terms = useTerms(vocabulary);
  const options: SelectOption[] = (terms.data ?? []).map((term) => ({ value: term.id, label: term.label }));
  const labelOf = (id: string): string => terms.data?.find((term) => term.id === id)?.label ?? '—';
  return { query: terms, options, labelOf };
}

export function useRubricLabels() {
  const terms = useTerms('charge_rubric');
  const options: SelectOption[] = (terms.data ?? []).map((term) => ({ value: term.key, label: term.label }));
  const labelOf = (key: string): string => terms.data?.find((term) => term.key === key)?.label ?? key;
  return { query: terms, options, labelOf };
}
