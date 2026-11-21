"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@eguardimmo/ui";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { AuthCard, AuthHeading } from "@/components/AuthCard";
import { CheckboxField } from "@/components/CheckboxField";
import { FormAlert } from "@/components/FormAlert";
import { AltLine } from "@/components/TextLink";
import { useAcceptTenantInvitation } from "@/features/auth/queries";
import { tenantConsentSchema } from "@/features/auth/schemas";
import type { TenantConsentValues } from "@/features/auth/schemas";
import type { TenantInvitationAcceptance } from "@/features/auth/source";
import { formatDate } from "@/lib/format";
import { useCountdown } from "@/lib/useCountdown";
import { consentLines, rateLimitedMessage, technicalProblem } from "./tenantInvitationCopy";

export type ScreenOutcome = Extract<TenantInvitationAcceptance["status"], "accepted" | "invalid" | "email_mismatch" | "email_unverified" | "unauthenticated">;

type Problem = { kind: "consent" | "account" | "party" | "technical"; message: string } | { kind: "limited"; seconds: number } | null;

const SCREEN_OUTCOMES: readonly string[] = ["accepted", "invalid", "email_mismatch", "email_unverified", "unauthenticated"];

function isScreenOutcome(status: string): status is ScreenOutcome {
  return SCREEN_OUTCOMES.includes(status);
}

function problemOf(result: TenantInvitationAcceptance, organisation: string): Problem {
  switch (result.status) {
    case "consent_required":
      return { kind: "consent", message: "Acceptez le rattachement de votre compte à votre dossier de location pour continuer." };
    case "account_already_linked":
      return {
        kind: "account",
        message: `Votre compte est déjà rattaché à une autre fiche chez ${organisation}. Votre invitation reste en attente : contactez ${organisation} pour qu’elle corrige votre dossier.`,
      };
    case "party_already_linked":
      return {
        kind: "party",
        message: `Ce dossier est déjà rattaché à un autre compte. Demandez à ${organisation} de retirer cet accès avant de vous inviter à nouveau.`,
      };
    case "rate_limited":
      return { kind: "limited", seconds: result.retryAfterSeconds };
    default:
      return null;
  }
}

export function TenantConsentForm({
  token,
  organisation,
  expiresAt,
  email,
  onOutcome,
  onSignOut,
}: {
  token: string;
  organisation: string;
  expiresAt: string;
  email: string;
  onOutcome: (outcome: ScreenOutcome) => void;
  onSignOut: () => void;
}) {
  const accept = useAcceptTenantInvitation();
  const [problem, setProblem] = useState<Problem>(null);
  const [lockSeconds, setLockSeconds] = useState(0);
  const remaining = useCountdown(lockSeconds);
  const form = useForm<TenantConsentValues>({ resolver: zodResolver(tenantConsentSchema), defaultValues: { consent: false } });
  const consent = useWatch({ control: form.control, name: "consent" });
  const locked = problem?.kind === "limited" && remaining > 0;

  const submit = form.handleSubmit(async () => {
    setProblem(null);
    try {
      const result = await accept.mutateAsync(token);
      if (isScreenOutcome(result.status)) {
        onOutcome(result.status);
        return;
      }
      const next = problemOf(result, organisation);
      if (next?.kind === "limited") setLockSeconds(next.seconds);
      setProblem(next);
    } catch (error) {
      setProblem({ kind: "technical", message: technicalProblem(error) });
    }
  });

  return (
    <AuthCard label="Accepter l’invitation">
      <AuthHeading
        title="Rattacher mon compte à mon dossier"
        description={
          <>
            <strong className="font-semibold [overflow-wrap:anywhere]">{organisation}</strong> vous invite à consulter votre location en ligne.
          </>
        }
        focus
      />
      {problem?.kind === "limited" && remaining > 0 ? (
        <FormAlert tone="warning" title="Trop de tentatives.">
          {rateLimitedMessage(remaining)}
        </FormAlert>
      ) : null}
      {problem && problem.kind !== "limited" ? (
        <FormAlert tone="danger" title={problem.kind === "technical" ? "Acceptation impossible pour le moment." : "Acceptation impossible."} focusOnMount>
          {problem.message}
        </FormAlert>
      ) : null}
      <section aria-label="Données partagées" className="flex flex-col gap-2 rounded-md border border-line bg-subtle p-3">
        <h2 className="text-body-strong text-fg">Ce que vous acceptez</h2>
        <ul className="flex list-disc flex-col gap-1 pl-4 text-body text-fg-muted [overflow-wrap:anywhere]">
          {consentLines(organisation).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      <p className="text-caption text-fg-subtle [overflow-wrap:anywhere]">
        Compte connecté : <span className="font-medium text-fg-muted">{email}</span>
      </p>
      <form noValidate onSubmit={(event) => { void submit(event); }} className="flex flex-col gap-4">
        <CheckboxField
          label={
            <span className="[overflow-wrap:anywhere]">
              J’accepte que mon compte soit rattaché à mon dossier de location chez {organisation}, et que {organisation} voie ce rattachement.
            </span>
          }
          error={form.formState.errors.consent?.message}
          {...form.register("consent")}
        />
        <Button type="submit" loading={form.formState.isSubmitting} disabled={!consent || locked} className="w-full">
          Accepter l’invitation
        </Button>
      </form>
      <AltLine>Cette invitation est valable jusqu’au {formatDate(expiresAt)}.</AltLine>
      <AltLine>
        Ce n’est pas votre compte ?{" "}
        <Button type="button" variant="link" size="sm" onClick={onSignOut}>
          Me déconnecter
        </Button>
      </AltLine>
    </AuthCard>
  );
}
