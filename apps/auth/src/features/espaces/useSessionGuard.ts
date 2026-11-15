"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/features/auth/queries";
import { ROUTES, withContext } from "@/lib/routes";

export function useSessionGuard() {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (session.data === null) router.replace(withContext(ROUTES.connexion, { suite: pathname }));
  }, [session.data, pathname, router]);
  return session;
}
