"use client";

import { RouteUnavailable } from "@eguardimmo/gestion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { familyLabel, unavailableFamilyOf } from "@/espace/capabilities";
import { dataSource } from "@/lib/env";

export function ApiRouteGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (dataSource !== "api") return children;
  const family = unavailableFamilyOf(pathname);
  if (family === null) return children;
  return <RouteUnavailable title={familyLabel[family]} isHome={family === "accueil"} Link={Link} />;
}
