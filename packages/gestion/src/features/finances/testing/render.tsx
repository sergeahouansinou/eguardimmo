import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { TestLink } from '../../../../test/render';
import type { FinancesData } from '../schemas';
import { createDemoFinancesSource, FinancesSourceProvider, parseFinances } from '../source';
import type { FinancesSource } from '../source';

export const norm = (text: string | null): string => (text ?? '').replace(/[\u00a0\u202f]/g, ' ');

export function renderFinances(ui: (props: { Link: typeof TestLink; navigate: (href: string) => void }) => ReactElement, source: FinancesSource = createDemoFinancesSource()) {
  const navigate = vi.fn<(href: string) => void>();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <FinancesSourceProvider source={source}>{ui({ Link: TestLink, navigate })}</FinancesSourceProvider>
    </QueryClientProvider>,
  );
  return { ...view, navigate, source };
}

export function rowAt(table: HTMLElement, index: number): HTMLElement {
  const row = within(table).getAllByRole('row')[index];
  if (!row) throw new Error(`Ligne ${String(index)} absente.`);
  return row;
}

export async function snapshotOf(source: FinancesSource): Promise<FinancesData> {
  return parseFinances(await source.snapshot());
}

export function inputValue(element: HTMLElement): string {
  if (!(element instanceof HTMLInputElement)) throw new Error('Champ de saisie attendu.');
  return element.value;
}

export function echeanceOf(data: FinancesData, id: string) {
  const found = data.echeances.find((item) => item.id === id);
  if (!found) throw new Error(`Échéance ${id} absente.`);
  return found;
}
