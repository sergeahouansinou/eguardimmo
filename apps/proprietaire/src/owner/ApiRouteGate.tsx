"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { familyLabel, unavailableFamilyOf } from "./capabilities";
import { RouteUnavailable } from "./RouteUnavailable";

export function ApiRouteGate({ children }: { children: ReactNode }) {
  const family = unavailableFamilyOf(usePathname());
  if (family === null) return children;
  return <RouteUnavailable title={familyLabel[family]} />;
}
