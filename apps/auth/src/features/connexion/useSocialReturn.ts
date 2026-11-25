"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import type { ReturnContext } from "@/features/auth/useReturnContext";
import { ROUTES } from "@/lib/routes";
import { readSocialProvider } from "@/lib/socialProviderMemo";

const REDIRECTED: Record<string, string> = {
  no_account: `${ROUTES.connexion}/compte-inconnu`,
  account_exists_link_required: `${ROUTES.connexion}/liaison-requise`,
};

export function useSocialReturn(context: ReturnContext): boolean {
  const router = useRouter();
  const code = useSearchParams().get("erreur");
  const target = code === null ? undefined : REDIRECTED[code];

  useEffect(() => {
    if (target === undefined) return;
    const provider = readSocialProvider();
    router.replace(context.to(target, provider === null ? {} : { fournisseur: provider }));
  }, [target, router, context]);

  return code !== null && target === undefined;
}
