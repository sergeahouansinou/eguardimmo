"use client";

import { SupportProvider, createSupportApiSource } from "@eguardimmo/messagerie";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { supportRoutes } from "@/espace/support";
import { useTenantSession } from "@/tenant/session";

export function SupportApiProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { client } = useTenantSession();
  const source = useMemo(() => createSupportApiSource({ client, space: "tenant" }), [client]);
  return (
    <SupportProvider
      space="tenant"
      source={source}
      routes={supportRoutes}
      Link={Link}
      navigate={(href) => { router.push(href); }}
    >
      {children}
    </SupportProvider>
  );
}
