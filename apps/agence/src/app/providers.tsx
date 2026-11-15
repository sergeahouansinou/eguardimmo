"use client";

import { MessagerieProvider, agenceProfile, createDemoMessagerieSource } from "@eguardimmo/messagerie";
import { ShellSourceProvider } from "@eguardimmo/shell";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider, TooltipProvider } from "@eguardimmo/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import { createDemoSource } from "@/espace/demo";
import { messagerieRoutes } from "@/espace/messagerie";

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }));
  const [source] = useState(createDemoSource);
  const [messagerie] = useState(() => createDemoMessagerieSource({ space: "agence" }));
  return (
    <QueryClientProvider client={client}>
      <ShellSourceProvider source={source}>
        <MessagerieProvider
          source={messagerie}
          profile={agenceProfile}
          routes={messagerieRoutes}
          Link={Link}
          navigate={(href) => { router.push(href); }}
        >
          <TooltipProvider>
            <ToastProvider>{children}</ToastProvider>
          </TooltipProvider>
        </MessagerieProvider>
      </ShellSourceProvider>
    </QueryClientProvider>
  );
}
