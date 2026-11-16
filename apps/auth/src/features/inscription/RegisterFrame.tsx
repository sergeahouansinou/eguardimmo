"use client";

import { ApiError, ApiUnreachableError } from "@eguardimmo/api";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthCard, AuthHeading } from "@/components/AuthCard";
import { FormAlert } from "@/components/FormAlert";
import { SocialButtons } from "@/components/SocialButtons";
import { AltLine, TextLink } from "@/components/TextLink";
import { useRegister, useSocialSignIn } from "@/features/auth/queries";
import type { RegisterProfile, SocialProvider } from "@/features/auth/schemas";
import type { RegisterInput } from "@/features/auth/source";
import { useSocialOutcome } from "@/features/connexion/SocialOutcome";
import { useReturnContext } from "@/features/auth/useReturnContext";
import { formatDuration } from "@/lib/format";
import { rememberVerificationEmail } from "@/lib/pendingVerification";
import { ROUTES } from "@/lib/routes";

const GENERIC_PROBLEM = "Une erreur est survenue. Réessayez dans un instant.";

export function registrationProblem(error: unknown): string {
  if (error instanceof ApiUnreachableError) return error.message;
  if (error instanceof ApiError && error.status === 422) {
    const messages = [...new Set(Object.values(error.fieldErrors).flat())];
    if (messages.length > 0) return messages.join(" ");
  }
  return GENERIC_PROBLEM;
}

export function useRegistration(profile: RegisterProfile) {
  const router = useRouter();
  const context = useReturnContext();
  const register = useRegister();
  const socialSignIn = useSocialSignIn();
  const onSocial = useSocialOutcome(context);
  const [problem, setProblem] = useState<ReactNode>(null);

  const submit = async (input: RegisterInput) => {
    setProblem(null);
    try {
      const result = await register.mutateAsync(input);
      if (result.status === "rate_limited") {
        setProblem(`Trop de demandes. Réessayez dans ${formatDuration(result.retryAfterSeconds)}.`);
        return;
      }
      rememberVerificationEmail(input.email);
      router.push(context.to(ROUTES.verificationEmail));
    } catch (error) {
      setProblem(registrationProblem(error));
    }
  };

  const social = (provider: SocialProvider, identityId: string) => {
    setProblem(null);
    void socialSignIn
      .mutateAsync({ provider, intent: "inscription", identityId, profile })
      .then((result) => { onSocial(result, provider); })
      .catch(() => { setProblem("Une erreur est survenue. Réessayez dans un instant."); });
  };

  return { context, problem, submit, social, busy: socialSignIn.isPending };
}

export function RegisterFrame({
  title,
  description,
  problem,
  busy,
  onSocial,
  footer,
  children,
}: {
  title: string;
  description: string;
  problem: ReactNode;
  busy: boolean;
  onSocial: (provider: SocialProvider, identityId: string) => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <AuthCard label={title}>
      <AuthHeading title={title} description={description} />
      {problem ? (
        <FormAlert tone="danger" title="Création impossible" focusOnMount>
          {problem}
        </FormAlert>
      ) : null}
      {children}
      <SocialButtons verb="S’inscrire avec" intent="inscription" busy={busy} onPick={onSocial} />
      {footer}
    </AuthCard>
  );
}

export function ChangeProfileLink() {
  const context = useReturnContext();
  return (
    <AltLine>
      <TextLink href={context.to(ROUTES.inscription)}>Changer de profil</TextLink>
    </AltLine>
  );
}
