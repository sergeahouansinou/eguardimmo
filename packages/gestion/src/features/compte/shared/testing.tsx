import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { TooltipProvider } from '@eguardimmo/ui';
import { TestLink } from '../../../../test/render';

export const navigate = vi.fn<(href: string) => void>();

export const screenProps = { Link: TestLink, navigate };

export function renderScreen(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>,
  );
}
