import { ToastProvider, TooltipProvider } from "@eguardimmo/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { PortefeuilleSourceProvider, createDemoSource } from "./source";
import type { PortefeuilleSource } from "./source";

export function renderPortefeuille(ui: ReactElement, source: PortefeuilleSource = createDemoSource()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  const result = render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ToastProvider>
          <PortefeuilleSourceProvider value={source}>{ui}</PortefeuilleSourceProvider>
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { ...result, source, client };
}

export function failingSource(): PortefeuilleSource {
  return { ...createDemoSource(), load: () => Promise.reject(new Error("Service indisponible")) };
}
