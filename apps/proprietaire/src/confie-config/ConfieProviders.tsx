"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";
import { ConfieSourceProvider } from "@/features/confie/data/source";
import { ToastProvider } from "@/features/confie/ui/Toast";
import { MessagerieSpaceProvider } from "@/features/messagerie/SpaceProvider";
import { createConfieSource } from "./demo";

export function ConfieProviders({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }));
  const [source] = useState(() => createConfieSource());
  return (
    <QueryClientProvider client={client}>
      <ConfieSourceProvider source={source}>
        <MessagerieSpaceProvider space="proprietaire">
          <ToastProvider>{children}</ToastProvider>
        </MessagerieSpaceProvider>
      </ConfieSourceProvider>
    </QueryClientProvider>
  );
}
