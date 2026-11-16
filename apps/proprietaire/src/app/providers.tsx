"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider, TooltipProvider } from "@eguardimmo/ui";
import { useState } from "react";
import type { ReactNode } from "react";
import { DemoGestionSource } from "@/lib/DemoGestionSource";
import { dataSource } from "@/lib/env";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }));
  const content = (
    <TooltipProvider>
      <ToastProvider>{children}</ToastProvider>
    </TooltipProvider>
  );
  return (
    <QueryClientProvider client={client}>
      {dataSource === "demo" ? <DemoGestionSource>{content}</DemoGestionSource> : content}
    </QueryClientProvider>
  );
}
