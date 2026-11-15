"use client";

import { TooltipProvider } from "@eguardimmo/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";
import { createDemoAuthSource } from "@/features/auth/demo";
import { AuthSourceProvider } from "@/features/auth/source";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } }));
  const [source] = useState(() => createDemoAuthSource());
  return (
    <QueryClientProvider client={client}>
      <AuthSourceProvider source={source}>
        <TooltipProvider>{children}</TooltipProvider>
      </AuthSourceProvider>
    </QueryClientProvider>
  );
}
