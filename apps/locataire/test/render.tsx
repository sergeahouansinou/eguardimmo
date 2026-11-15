import { TooltipProvider } from "@eguardimmo/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { FlashRegion } from "@/components/flash";
import { createDemoSource } from "@/data/demoSource";
import { LocataireSourceProvider } from "@/data/source";
import type { LocataireSource } from "@/data/source";
import { resetNavigation } from "./navigation";

interface Options {
  source?: LocataireSource;
  pathname?: string;
  search?: string;
}

export function renderScreen(ui: ReactElement, { source = createDemoSource(), pathname = "/", search = "" }: Options = {}) {
  resetNavigation(pathname, search);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={client}>
      <LocataireSourceProvider source={source}>
        <TooltipProvider>
          <FlashRegion />
          {ui}
        </TooltipProvider>
      </LocataireSourceProvider>
    </QueryClientProvider>,
  );
  return { ...view, user, source };
}
