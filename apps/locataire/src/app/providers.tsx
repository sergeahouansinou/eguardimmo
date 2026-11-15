"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MessagerieProvider, createDemoMessagerieSource, locataireProfile } from "@eguardimmo/messagerie";
import { TooltipProvider } from "@eguardimmo/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import { LocataireSourceProvider } from "@/data/source";
import { createDemoSource } from "@/data/demoSource";
import { messagerieRoutes } from "@/espace/messagerie";

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }));
  const [source] = useState(createDemoSource);
  const [messagerie] = useState(() => createDemoMessagerieSource({ space: "locataire" }));
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
