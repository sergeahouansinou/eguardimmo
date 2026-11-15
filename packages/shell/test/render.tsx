import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ComponentProps, ReactElement } from 'react';
import { ShellSourceProvider } from '../src/data/source';
import type { ShellSource } from '../src/data/source';
import { createTestSource } from './fixtures';

export function renderWithSource(ui: ReactElement, source: ShellSource = createTestSource()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ShellSourceProvider source={source}>{ui}</ShellSourceProvider>
    </QueryClientProvider>,
  );
}

export function TestLink({ children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a {...props}>{children}</a>;
}
