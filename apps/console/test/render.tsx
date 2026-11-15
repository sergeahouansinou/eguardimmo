import { ToastProvider, TooltipProvider } from '@eguardimmo/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { DEMO_NOW } from '@/console/demo/clock';
import { createDemoSource } from '@/console/demo/source';
import { ConsoleSourceProvider } from '@/console/source';
import type { ConsoleSource } from '@/console/source';

export interface ConsoleRender extends RenderResult {
  source: ConsoleSource;
}

export function renderWithConsole(ui: ReactElement): ConsoleRender {
  const fixed = new Date(DEMO_NOW);
  return renderWithSource(ui, createDemoSource({ clock: () => fixed }));
}

export function renderWithSource(ui: ReactElement, source: ConsoleSource): ConsoleRender {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } } });
  const result = render(
    <QueryClientProvider client={client}>
      <ConsoleSourceProvider source={source}>
        <TooltipProvider>
          <ToastProvider>{ui}</ToastProvider>
        </TooltipProvider>
      </ConsoleSourceProvider>
    </QueryClientProvider>,
  );
  return Object.assign(result, { source });
}
