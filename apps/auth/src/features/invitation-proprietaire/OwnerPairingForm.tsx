"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@eguardimmo/ui";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { AuthCard, AuthHeading } from "@/components/AuthCard";
import { CheckboxField } from "@/components/CheckboxField";
import { CodeInput } from "@/components/CodeInput";
import { FormAlert } from "@/components/FormAlert";
import { AltLine } from "@/components/TextLink";
import { useAcceptOwnerInvitation } from "@/features/auth/queries";
import { OWNER_PAIRING_CODE_LENGTH, ownerPairingSchema } from "@/features/auth/ownerInvitationSchemas";
import type { OwnerPairingValues, OwnerRole } from "@/features/auth/ownerInvitationSchemas";
import type { OwnerInvitationAcceptance } from "@/features/auth/source";
import { formatDate } from "@/lib/format";
import { useCountdown } from "@/lib/useCountdown";
import { CODE_INVALID_MESSAGE, ROLE_LABELS, consentLines, rateLimitedMessage, technicalProblem } from "./ownerInvitationCopy";

export type OwnerScreenOutcome = Extract<OwnerInvitationAcceptance["status"], "accepted" | "invalid" | "email_mismatch" | "email_unverified" | "unauthenticated">;

type Problem = { kind: "code" | "consent" | "linked" | "limit" | "technical"; message: string } | { kind: "limited"; seconds: number } | null;

const SCREEN_OUTCOMES: readonly string[] = ["accepted", "invalid", "email_mismatch", "email_unverified", "unauthenticated"];

function isScreenOutcome(status: string): status is OwnerScreenOutcome {
  return SCREEN_OUTCOMES.includes(status);
}

function problemOf(result: OwnerInvitationAcceptance, organisation: string): Problem {
  switch (result.status) {
    case "code_invalid":
      return { kind: "code", message: CODE_INVALID_MESSAGE };
    case "consent_required":
      return { kind: "consent", message: "Acceptez le rattachement de votre compte à votre mandat pour continuer." };
    case "already_linked":
      return { kind: "linked", message: `Votre compte est déjà rattaché à ce mandat chez ${organisation}. Ouvrez votre espace propriétaire depuis la liste de vos espaces.` };
    case "limit_reached":
      return { kind: "limit", message: `${organisation} ne peut plus rattacher de compte à ce mandat. Votre invitation reste en attente : contactez ${organisation}.` };
    case "rate_limited":
      return { kind: "limited", seconds: result.retryAfterSeconds };
    default:
      return null;
  }
}

export function OwnerPairingForm({
  token,
  organisation,
  role,
  expiresAt,
  email,
  onOutcome,
  onSignOut,
}: {
  token: string;
  organisation: string;
  role: OwnerRole;
  expiresAt: string;
  email: string;
  onOutcome: (outcome: OwnerScreenOutcome, role?: OwnerRole) => void;
  onSignOut: () => void;
}) {
  const accept = useAcceptOwnerInvitation();
  const [problem, setProblem] = useState<Problem>(null);
  const [lockSeconds, setLockSeconds] = useState(0);
  const [focusSignal, setFocusSignal] = useState(0);
  const remaining = useCountdown(lockSeconds);
  const form = useForm<OwnerPairingValues>({ resolver: zodResolver(ownerPairingSchema), defaultValues: { code: "", consent: false } });
  const consent = useWatch({ control: form.control, name: "consent" });
  const code = useWatch({ control: form.control, name: "code" });
  const locked = problem?.kind === "limited" && remaining > 0;
  const codeError = form.formState.errors.code?.message ?? (problem?.kind === "code" ? problem.message : undefined);

  const submit = form.handleSubmit(async (values) => {
    setProblem(null);
    try {
      const result = await accept.mutateAsync({ token, code: values.code });
      if (isScreenOutcome(result.status)) {
        onOutcome(result.status, result.status === "accepted" ? result.role : undefined);
        return;
      }
      const next = problemOf(result, organisation);
      if (next?.kind === "limited") setLockSeconds(next.seconds);
      setProblem(next);
    } catch (error) {
      setProblem({ kind: "technical", message: technicalProblem(error) });
    } finally {
      accept.reset();
      form.resetField("code", { defaultValue: "" });
      setFocusSignal((value) => value + 1);
    }
  });

  return (
    <AuthCard label="Accepter l’invitation">
      <AuthHeading
        title="Rattacher mon compte à mon mandat"
        description={
          <>
            <strong className="font-semibold [overflow-wrap:anywhere]">{organisation}</strong> vous invite à consulter vos biens confiés en ligne, en tant que {ROLE_LABELS[role]}.
          </>
        }
        focus
      />
      {problem?.kind === "limited" && remaining > 0 ? (
        <FormAlert tone="warning" title="Trop de tentatives.">
          {rateLimitedMessage(remaining)}
        </FormAlert>
      ) : null}
      {problem && problem.kind !== "limited" && problem.kind !== "code" ? (
        <FormAlert tone="danger" title={problem.kind === "technical" ? "Acceptation impossible pour le moment." : "Acceptation impossible."} focusOnMount>
          {problem.message}
        </FormAlert>
      ) : null}
      <section aria-label="Données partagées" className="flex flex-col gap-2 rounded-md border border-line bg-subtle p-3">
        <h2 className="text-body-strong text-fg">Ce que vous acceptez</h2>
        <ul className="flex list-disc flex-col gap-1 pl-4 text-body text-fg-muted [overflow-wrap:anywhere]">
          {consentLines(organisation, role).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      <p className="text-caption text-fg-subtle [overflow-wrap:anywhere]">
        Compte connecté : <span className="font-medium text-fg-muted">{email}</span>
      </p>
      <form noValidate onSubmit={(event) => { void submit(event); }} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span id="owner-code-label" className="text-body-strong text-fg">Code d’appariement</span>
          <p id="owner-code-hint" className="text-caption text-fg-subtle">
            {`Les ${String(OWNER_PAIRING_CODE_LENGTH)} chiffres que ${organisation} vous a remis de vive voix, par téléphone ou à la signature du mandat. Ils ne sont pas dans l’e-mail d’invitation.`}
          </p>
          <Controller
            control={form.control}
            name="code"
            render={({ field }) => (
              <CodeInput
                value={field.value}
                onChange={field.onChange}
                label="Code d’appariement"
                length={OWNER_PAIRING_CODE_LENGTH}
                invalid={codeError !== undefined}
                disabled={locked}
                describedBy={codeError === undefined ? "owner-code-hint" : "owner-code-hint owner-code-error"}
                focusSignal={focusSignal}
              />
            )}
          />
          {codeError ? (
            <p id="owner-code-error" role="alert" className="text-caption text-fg-danger">
              {codeError}
            </p>
          ) : null}
        </div>
        <CheckboxField
          label={
            <span className="[overflow-wrap:anywhere]">
              J’accepte que mon compte soit rattaché à mon mandat chez {organisation}, et que {organisation} voie ce rattachement.
            </span>
          }
          error={form.formState.errors.consent?.message}
          {...form.register("consent")}
        />
        <Button type="submit" loading={form.formState.isSubmitting} disabled={!consent || code.length < OWNER_PAIRING_CODE_LENGTH || locked} className="w-full">
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
