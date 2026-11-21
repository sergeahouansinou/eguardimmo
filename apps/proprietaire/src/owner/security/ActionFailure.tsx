"use client";

import { Alert, Button } from "@eguardimmo/ui";
import { describeFailure } from "../errors";
import { authLink, signInHref, useOwnerSession } from "../session";
import { TWO_FACTOR_SETUP_PATH, currentPageUrl, passwordReauthHref, reauthHref } from "./reauth";

interface Recovery {
  href: string;
  label: string;
}

export type ReauthMethod = "code" | "password";

function recoveryOf(kind: string, authUrl: string | undefined, method: ReauthMethod): Recovery | null {
  if (kind === "reauthenticationRequired") {
    const href = (method === "password" ? passwordReauthHref : reauthHref)(authUrl, currentPageUrl());
    return href === null ? null : { href, label: "Confirmer mon identité" };
  }
  if (kind === "twoFactorRequired") {
    const href = authLink(authUrl, TWO_FACTOR_SETUP_PATH);
    return href === null ? null : { href, label: "Activer la double authentification" };
  }
  if (kind === "unauthenticated") {
    const href = signInHref(authUrl);
    return href === null ? null : { href, label: "Se connecter" };
  }
  return null;
}

export interface ActionFailureProps {
  error: unknown;
  title: string;
  retryable?: boolean;
  reauth?: ReauthMethod;
}

const PASSWORD_REAUTH_MESSAGE = "Pour votre sécurité, confirmez votre identité avec votre mot de passe ou un code de double authentification récent pour continuer.";

export function ActionFailure({ error, title, retryable = false, reauth = "code" }: ActionFailureProps) {
  const { authUrl } = useOwnerSession();
  const failure = describeFailure(error);
  const recovery = recoveryOf(failure.kind, authUrl, reauth);
  const message = failure.kind === "reauthenticationRequired" && reauth === "password" ? PASSWORD_REAUTH_MESSAGE : failure.message;
  return (
    <Alert tone="danger" title={title}>
      <span className="flex flex-col items-start gap-2">
        {message}
        {failure.kind === "reauthenticationRequired" ? "Vous serez ramené sur cette page ; ce que vous avez saisi devra être ressaisi." : null}
        {retryable && failure.kind === "unreachable" ? "Vous pouvez réessayer : la même demande ne sera enregistrée qu’une seule fois." : null}
        {recovery ? (
          <Button asChild variant="secondary" size="sm">
            <a href={recovery.href}>{recovery.label}</a>
          </Button>
        ) : null}
      </span>
    </Alert>
  );
}
