"use client";

import { BiensRoot as GestionBiensRoot } from "@eguardimmo/gestion/biens";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { dataSource } from "@/lib/env";

export function BiensRoot({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const environment = useMemo(
    () => ({ Link, pathname, push: (href: string) => { router.push(href); } }),
    [pathname, router],
  );
  return (
    <GestionBiensRoot mode={dataSource} environment={environment}>
      {children}
    </GestionBiensRoot>
  );
}
