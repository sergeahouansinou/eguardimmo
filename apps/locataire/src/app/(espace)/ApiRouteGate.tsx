"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { RouteUnavailable } from "@/components/RouteUnavailable";
import { familyLabel, unavailableFamilyOf } from "@/espace/capabilities";
import { familyCopy } from "@/espace/unavailableCopy";
import { dataSource } from "@/lib/env";

export function ApiRouteGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (dataSource !== "api") return children;
  const family = unavailableFamilyOf(pathname);
  if (family === null) return children;
  const copy = familyCopy[family];
  return <RouteUnavailable title={familyLabel[family]} alertTitle={copy?.alertTitle} description={copy?.description} links={copy?.links} />;
}
