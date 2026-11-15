"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuthSource } from "@/features/auth/source";
import { ROUTES, withContext } from "@/lib/routes";

export function useRequireConfirmation() {
  const router = useRouter();
  const pathname = usePathname();
  return (needsCode: boolean) => {
    const target = needsCode ? `${ROUTES.confirmation}/code` : ROUTES.confirmation;
    router.push(withContext(target, { suite: pathname }, needsCode ? { exige: "code" } : {}));
  };
}

export function withConfirmed(path: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}confirme=1`;
}

export function useIsConfirmed(confirmedUntil: string | null | undefined): boolean {
  const source = useAuthSource();
  return confirmedUntil !== null && confirmedUntil !== undefined && new Date(confirmedUntil).getTime() > source.now().getTime();
}
