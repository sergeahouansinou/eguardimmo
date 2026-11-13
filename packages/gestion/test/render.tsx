import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ComponentProps, ReactElement } from 'react';
import { createDemoSource } from '../src/data/demo';
import { GestionSourceProvider } from '../src/data/source';
import type { GestionSource } from '../src/data/source';

export function renderWithSource(ui: ReactElement, source: GestionSource = createDemoSource()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GestionSourceProvider source={source}>{ui}</GestionSourceProvider>
    </QueryClientProvider>,
  );
}

export function TestLink({ children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a {...props}>{children}</a>;
}
