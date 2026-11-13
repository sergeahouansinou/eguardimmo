"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestionSourceProvider, createDemoSource } from "@eguardimmo/gestion";
import { TooltipProvider } from "@eguardimmo/ui";
import { useState } from "react";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }));
  const [source] = useState(createDemoSource);
  return (
    <QueryClientProvider client={client}>
      <GestionSourceProvider source={source}>
        <TooltipProvider>{children}</TooltipProvider>
      </GestionSourceProvider>
    </QueryClientProvider>
  );
}
