"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";
import { ConfieSourceProvider } from "@/features/confie/data/source";
import { ToastProvider } from "@/features/confie/ui/Toast";
import { MessagerieSpaceProvider } from "@/features/messagerie/SpaceProvider";
import { dataSource } from "@/lib/env";
import { ApiOwnerData } from "@/owner/ApiOwnerData";
import { shouldRetry } from "@/owner/errors";
import { createConfieSource } from "./demo";

function DemoConfieProviders({ children }: { children: ReactNode }) {
  const [source] = useState(() => createConfieSource());
  return (
    <ConfieSourceProvider source={source}>
      <MessagerieSpaceProvider space="proprietaire">
        <ToastProvider>{children}</ToastProvider>
      </MessagerieSpaceProvider>
    </ConfieSourceProvider>
  );
}

export function ConfieProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, ...(dataSource === "api" ? { retry: shouldRetry } : {}) } } }),
  );
  return (
    <QueryClientProvider client={client}>
      {dataSource === "api" ? <ApiOwnerData>{children}</ApiOwnerData> : <DemoConfieProviders>{children}</DemoConfieProviders>}
    </QueryClientProvider>
  );
}
