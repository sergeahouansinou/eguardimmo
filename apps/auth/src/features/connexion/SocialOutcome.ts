"use client";

import { useRouter } from "next/navigation";
import type { SocialProvider } from "@/features/auth/schemas";
import type { SocialResult } from "@/features/auth/source";
import type { ReturnContext } from "@/features/auth/useReturnContext";
import { ROUTES } from "@/lib/routes";

export function useSocialOutcome(context: ReturnContext) {
  const router = useRouter();
  return (result: SocialResult, provider: SocialProvider) => {
    switch (result.status) {
      case "authenticated":
        context.afterAuthentication();
        break;
      case "two_factor_required":
        router.push(context.to(`${ROUTES.connexion}/verification`));
        break;
      case "account_not_found":
        router.push(context.to(`${ROUTES.connexion}/compte-inconnu`, { fournisseur: provider }));
        break;
      case "link_required":
        router.push(context.to(`${ROUTES.connexion}/liaison-requise`, { fournisseur: provider }));
        break;
    }
  };
}
