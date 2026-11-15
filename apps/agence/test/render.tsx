import { ToastProvider, TooltipProvider } from "@eguardimmo/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { AgenceSourceProvider, createDemoSource } from "../src/features/source";
import type { AgenceSource } from "../src/features/source";

export function renderScreen(ui: ReactElement, source: AgenceSource = createDemoSource()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  const result = render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ToastProvider>
          <AgenceSourceProvider source={source}>{ui}</AgenceSourceProvider>
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { ...result, source, client };
}
