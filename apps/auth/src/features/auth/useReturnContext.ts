"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { APP_LABELS } from "@/lib/spaces";
import { isInternalPath, parseReturnTo } from "@/lib/returnTo";
import type { ReturnTo } from "@/lib/returnTo";
import { ROUTES, withContext } from "@/lib/routes";
import type { RouteContext } from "@/lib/routes";

export interface ReturnContext {
  rawReturnTo: string | null;
  returnTo: ReturnTo;
  suite: string | null;
  context: RouteContext;
  spaceLabel: string | null;
  to: (path: string, extra?: Record<string, string>) => string;
  afterAuthentication: () => void;
}

export function useReturnContext(): ReturnContext {
  const params = useSearchParams();
  const router = useRouter();
  const rawReturnTo = params.get("return_to");
  const suiteParam = params.get("suite");
  const suite = isInternalPath(suiteParam) ? suiteParam : null;

  return useMemo(() => {
    const returnTo = parseReturnTo(rawReturnTo);
    const context: RouteContext = { returnTo: returnTo.status === "absent" ? null : rawReturnTo, suite };
    const to = (path: string, extra: Record<string, string> = {}) => withContext(path, context, extra);
    const spaceLabel = returnTo.status === "ok" ? (returnTo.app ? APP_LABELS[returnTo.app] : "votre espace") : null;
    const afterAuthentication = () => {
      if (returnTo.status === "refused") {
        router.replace(withContext(ROUTES.retourRefuse, {}, { adresse: rawReturnTo ?? "" }));
      } else if (returnTo.status === "ok") {
        router.push(to(ROUTES.continuer));
      } else {
        router.push(suite ?? ROUTES.profils);
      }
    };
    return { rawReturnTo, returnTo, suite, context, spaceLabel, to, afterAuthentication };
  }, [rawReturnTo, suite, router]);
}
