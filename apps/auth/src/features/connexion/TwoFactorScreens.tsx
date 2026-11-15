"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, TextField } from "@eguardimmo/ui";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { AuthCard, AuthHeading } from "@/components/AuthCard";
import { CodeInput } from "@/components/CodeInput";
import { DemoNotice } from "@/components/DemoNotice";
import { FormAlert } from "@/components/FormAlert";
import { AltLine, TextLink } from "@/components/TextLink";
import { useVerifyBackupCode, useVerifyTwoFactor } from "@/features/auth/queries";
import { backupCodeFormSchema, totpCodeSchema } from "@/features/auth/schemas";
import type { BackupCodeValues } from "@/features/auth/schemas";
import type { TwoFactorResult } from "@/features/auth/source";
import { useReturnContext } from "@/features/auth/useReturnContext";
import { formatDuration } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { useCountdown } from "@/lib/useCountdown";

type Problem = "invalid" | "locked" | "expired" | "technical" | "format" | null;

function useChallengeState() {
  const [problem, setProblem] = useState<Problem>(null);
  const [lockSeconds, setLockSeconds] = useState(0);
  const remaining = useCountdown(lockSeconds);
  const apply = (result: TwoFactorResult) => {
    if (result.status === "invalid_code") setProblem("invalid");
    else if (result.status === "challenge_expired") setProblem("expired");
    else if (result.status === "locked") {
      setLockSeconds(result.retryAfterSeconds);
      setProblem("locked");
    }
  };
  return { problem, setProblem, remaining, locked: problem === "locked" && remaining > 0, apply };
}

function ChallengeAlerts({
  problem,
  locked,
  remaining,
  context,
}: {
  problem: Problem;
  locked: boolean;
  remaining: number;
  context: ReturnType<typeof useReturnContext>;
}) {
  return (
    <>
      {problem === "locked" && locked ? (
        <FormAlert tone="warning" title="Trop de tentatives.">
          Réessayez dans {formatDuration(remaining)}.
        </FormAlert>
      ) : null}
      {problem === "expired" ? (
        <FormAlert tone="warning" title="Votre vérification a expiré." focusOnMount>
          Reprenez la connexion depuis le début. <TextLink href={context.to(ROUTES.connexion)}>Retour à la connexion</TextLink>
        </FormAlert>
      ) : null}
      {problem === "technical" ? (
        <FormAlert tone="danger" title="Vérification impossible pour le moment." focusOnMount>
          Une erreur est survenue. Réessayez dans un instant.
        </FormAlert>
      ) : null}
    </>
  );
}

export function TwoFactorScreen() {
  const context = useReturnContext();
  const verify = useVerifyTwoFactor();
  const state = useChallengeState();
  const [code, setCode] = useState("");
  const [focusSignal, setFocusSignal] = useState(0);

  const submit = async () => {
    const parsed = totpCodeSchema.safeParse(code);
    if (!parsed.success) {
      state.setProblem("format");
      return;
    }
    state.setProblem(null);
    try {
      const result = await verify.mutateAsync(parsed.data);
      if (result.status === "authenticated") {
        context.afterAuthentication();
        return;
      }
      state.apply(result);
      setCode("");
      setFocusSignal((value) => value + 1);
    } catch {
      state.setProblem("technical");
    }
  };

  return (
    <AuthCard label="Vérification en deux étapes">
      <AuthHeading
        title="Vérification en deux étapes"
        description="Saisissez le code à 6 chiffres affiché par votre application d’authentification."
      />
      {state.problem === "invalid" ? (
        <FormAlert tone="danger" title="Code incorrect." focusOnMount>
          Vérifiez l’heure de votre téléphone. Après 5 essais, patientez une minute.
        </FormAlert>
      ) : null}
      {state.problem === "format" ? (
        <FormAlert tone="danger" title="Le code comporte 6 chiffres." focusOnMount>
          Saisissez les 6 chiffres affichés par votre application.
        </FormAlert>
      ) : null}
      <ChallengeAlerts problem={state.problem} locked={state.locked} remaining={state.remaining} context={context} />
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-4"
      >
        <CodeInput
          label="Code à 6 chiffres"
          value={code}
          onChange={setCode}
          invalid={state.problem === "invalid" || state.problem === "format"}
          disabled={state.locked}
          focusOnMount
          focusSignal={focusSignal}
        />
        <Button type="submit" loading={verify.isPending} disabled={state.locked} className="w-full">
          Valider le code
        </Button>
      </form>
      <AltLine>
        Plus accès à votre application ?{" "}
        <TextLink href={context.to(`${ROUTES.connexion}/code-de-secours`)}>Utiliser un code de secours</TextLink>
      </AltLine>
      <DemoNotice>Code valide de démonstration : 481305.</DemoNotice>
    </AuthCard>
  );
}

export function BackupCodeScreen() {
  const context = useReturnContext();
  const verify = useVerifyBackupCode();
  const state = useChallengeState();
  const form = useForm<BackupCodeValues>({
    resolver: zodResolver(backupCodeFormSchema),
    defaultValues: { code: "" },
  });
  const { setFocus } = form;
  useEffect(() => {
    setFocus("code");
  }, [setFocus]);

  const submit = form.handleSubmit(async (values) => {
    state.setProblem(null);
    try {
      const result = await verify.mutateAsync(values.code);
      if (result.status === "authenticated") {
        context.afterAuthentication();
        return;
      }
      state.apply(result);
      form.resetField("code");
      setFocus("code");
    } catch {
      state.setProblem("technical");
    }
  });

  return (
    <AuthCard label="Code de secours">
      <AuthHeading
        title="Code de secours"
        description="Saisissez l’un des codes de secours remis à l’activation de la double authentification."
      />
      {state.problem === "invalid" ? (
        <FormAlert tone="danger" title="Code de secours refusé." focusOnMount>
          Ce code est inconnu ou a déjà été utilisé.
        </FormAlert>
      ) : null}
      <ChallengeAlerts problem={state.problem} locked={state.locked} remaining={state.remaining} context={context} />
      <form noValidate onSubmit={(event) => { void submit(event); }} className="flex flex-col gap-4">
        <TextField
          label="Code de secours *"
          placeholder="k3Jx9aQw2L-p0Zr7Tm4Vn"
          autoComplete="one-time-code"
          autoCapitalize="none"
          spellCheck={false}
          disabled={state.locked}
          error={form.formState.errors.code?.message}
          {...form.register("code")}
        />
        <FormAlert tone="info" title="Chaque code ne fonctionne qu’une fois.">
          Pensez à en régénérer une fois la connexion rétablie.
        </FormAlert>
        <Button type="submit" loading={form.formState.isSubmitting} disabled={state.locked} className="w-full">
          Valider le code de secours
        </Button>
      </form>
      <AltLine>
        <TextLink href={context.to(`${ROUTES.connexion}/verification`)}>Revenir au code de l’application</TextLink>
      </AltLine>
      <DemoNotice>Codes de secours de démonstration (compte Koffi) : r5n7v-4bj2e, c9y1f-6ks3u…</DemoNotice>
    </AuthCard>
  );
}
