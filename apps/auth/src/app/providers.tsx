"use client";

import { createApiClient } from "@eguardimmo/api";
import { TooltipProvider } from "@eguardimmo/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";
import { createApiAuthSource } from "@/features/auth/api";
import { createDemoAuthSource } from "@/features/auth/demo";
import { AuthSourceProvider } from "@/features/auth/source";
import type { AuthSource } from "@/features/auth/source";
import { apiEnv, dataSource } from "@/lib/env";

function createSource(): AuthSource {
  if (dataSource === "api") return createApiAuthSource(createApiClient({ baseUrl: apiEnv().NEXT_PUBLIC_API_URL }));
  return createDemoAuthSource();
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } }));
  const [source] = useState(createSource);
  return (
    <QueryClientProvider client={client}>
      <AuthSourceProvider source={source}>
        <TooltipProvider>{children}</TooltipProvider>
      </AuthSourceProvider>
    </QueryClientProvider>
  );
}
