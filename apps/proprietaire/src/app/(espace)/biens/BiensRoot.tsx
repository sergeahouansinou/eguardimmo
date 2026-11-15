"use client";

import { BiensProviders, createDemoBiensSource } from "@eguardimmo/gestion/biens";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

export function BiensRoot({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [source] = useState(() => createDemoBiensSource());
  const environment = useMemo(
    () => ({ Link, pathname, push: (href: string) => { router.push(href); } }),
    [pathname, router],
  );
  return (
    <BiensProviders source={source} environment={environment}>
      {children}
    </BiensProviders>
  );
}
