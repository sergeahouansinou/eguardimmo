"use client";

import { ArrowRight, CircleCheck } from "lucide-react";
import { Icon, Spinner } from "@eguardimmo/ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { AltLine } from "@/components/TextLink";
import { StatusScreen } from "@/components/StatusScreen";
import { useProfiles } from "@/features/auth/queries";
import { useReturnContext } from "@/features/auth/useReturnContext";
import { redirectTo } from "@/lib/navigation";
import { ROUTES } from "@/lib/routes";
import { appOfProfile } from "@/lib/spaces";
import { useSessionGuard } from "./useSessionGuard";

export function ContinuerScreen() {
  const router = useRouter();
  const context = useReturnContext();
  const session = useSessionGuard();
  const profiles = useProfiles(Boolean(session.data));
  const done = useRef(false);
  const { returnTo } = context;

  const accessible =
    returnTo.status === "ok" && profiles.data
      ? returnTo.app === null || profiles.data.some((profile) => appOfProfile(profile.kind) === returnTo.app)
      : null;

  useEffect(() => {
    if (done.current || !session.data) return;
    if (returnTo.status === "refused") {
      done.current = true;
      router.replace(`${ROUTES.retourRefuse}?adresse=${encodeURIComponent(context.rawReturnTo ?? "")}`);
    } else if (returnTo.status === "absent") {
      done.current = true;
      router.replace(context.suite ?? ROUTES.profils);
    } else if (accessible === true) {
      done.current = true;
      redirectTo(returnTo.url);
    } else if (accessible === false) {
      done.current = true;
      router.replace(`${ROUTES.accesRefuse}?espace=${returnTo.app ?? ""}`);
    }
  }, [accessible, returnTo, router, session.data, context.rawReturnTo, context.suite]);

  if (returnTo.status !== "ok") {
    return (
      <StatusScreen icon={CircleCheck} title="Connexion réussie" description="Redirection en cours.">
        <Spinner size={20} label="Redirection en cours" />
      </StatusScreen>
    );
  }

  return (
    <StatusScreen
      icon={CircleCheck}
      tone="success"
      title="Connexion réussie"
      description={`Retour vers votre ${context.spaceLabel ?? "espace"} en cours.`}
    >
      <Spinner size={20} label="Redirection en cours" className="self-center" />
      <AltLine>
        Rien ne se passe ?{" "}
        {accessible === true ? (
          <a
            href={returnTo.url}
            className="inline-flex items-center gap-1 rounded-sm px-0.5 text-caption font-medium text-action-on-subtle underline underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Continuer manuellement <Icon icon={ArrowRight} size={14} />
          </a>
        ) : (
          <span>Vérification de vos accès…</span>
        )}
      </AltLine>
    </StatusScreen>
  );
}
