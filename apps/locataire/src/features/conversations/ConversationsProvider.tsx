"use client";

import { ExternalMessagerieProvider, createExternalApiSource } from "@eguardimmo/messagerie";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { externalMessagerieRoutes } from "@/espace/messagerie";
import { useTenantSession } from "@/tenant/session";

export function ConversationsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { client } = useTenantSession();
  const source = useMemo(() => createExternalApiSource({ client, space: "tenant" }), [client]);
  return (
    <ExternalMessagerieProvider
      space="tenant"
      source={source}
      routes={externalMessagerieRoutes}
      Link={Link}
      navigate={(href) => { router.push(href); }}
    >
      {children}
    </ExternalMessagerieProvider>
  );
}
