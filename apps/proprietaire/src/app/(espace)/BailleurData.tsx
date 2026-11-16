"use client";

import { GestionApiData } from "@eguardimmo/gestion";
import type { ReactNode } from "react";
import { apiEnv, dataSource } from "@/lib/env";

export function BailleurData({ children }: { children: ReactNode }) {
  if (dataSource === "demo") return children;
  const env = apiEnv();
  return (
    <GestionApiData apiUrl={env.NEXT_PUBLIC_API_URL} authUrl={env.NEXT_PUBLIC_AUTH_URL} kind="individual">
      {children}
    </GestionApiData>
  );
}
