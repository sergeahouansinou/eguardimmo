"use client";

import { createApiClient } from "@eguardimmo/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MessagerieProvider, createApiMessagerieSource, createDemoMessagerieSource, locataireProfile } from "@eguardimmo/messagerie";
import type { MessagerieSource } from "@eguardimmo/messagerie";
import { TooltipProvider } from "@eguardimmo/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import { LocataireSourceProvider } from "@/data/source";
import { createDemoSource } from "@/data/demoSource";
import { messagerieRoutes } from "@/espace/messagerie";
import { apiEnv, dataSource } from "@/lib/env";

function createMessagerieSource(): MessagerieSource {
  if (dataSource === "demo") return createDemoMessagerieSource({ space: "locataire" });
  return createApiMessagerieSource({ client: createApiClient({ baseUrl: apiEnv().NEXT_PUBLIC_API_URL }), organizationId: null, space: "locataire" });
}

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }));
  const [source] = useState(createDemoSource);
  const [messagerie] = useState(createMessagerieSource);
  return (
    <QueryClientProvider client={client}>
      <LocataireSourceProvider source={source}>
        <MessagerieProvider
          source={messagerie}
          profile={locataireProfile}
          routes={messagerieRoutes}
          Link={Link}
          navigate={(href) => { router.push(href); }}
        >
          <TooltipProvider>{children}</TooltipProvider>
        </MessagerieProvider>
      </LocataireSourceProvider>
    </QueryClientProvider>
  );
}
