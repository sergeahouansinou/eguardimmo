"use client";

import { MailCheck } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError, ApiUnreachableError } from "@eguardimmo/api";
import { Button, Spinner, TextField } from "@eguardimmo/ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SyntheticEvent } from "react";
import { useForm } from "react-hook-form";
import { AuthCard } from "@/components/AuthCard";
import { DemoNotice } from "@/components/DemoNotice";
import { FormAlert } from "@/components/FormAlert";
import { AltLine, TextLink } from "@/components/TextLink";
import { StatusScreen } from "@/components/StatusScreen";
import { useResendVerification, useVerificationStatus, useVerifyEmail } from "@/features/auth/queries";
import { forgotPasswordSchema } from "@/features/auth/schemas";
import type { ForgotPasswordValues } from "@/features/auth/schemas";
import { useReturnContext } from "@/features/auth/useReturnContext";
import { formatDuration } from "@/lib/format";
import { forgetVerificationEmail, useRememberedVerificationEmail } from "@/lib/pendingVerification";
import { ROUTES } from "@/lib/routes";
import { useConsumedParams } from "@/lib/useConsumedParams";
import { useCountdown } from "@/lib/useCountdown";

const VERIFICATION_LINK_PARAMS = ["jeton"] as const;

const RESEND_COOLDOWN_SECONDS = 60;

type ResendOutcome = { kind: "sent" } | { kind: "limited"; seconds: number } | { kind: "failed"; message: string };

interface Cooldown {
  seconds: number;
  id: number;
}

function resendProblem(error: unknown): string {
  if (error instanceof ApiUnreachableError) return error.message;
  if (error instanceof ApiError && error.status === 422) return "Cette adresse e-mail n’est pas valide.";
  return "Réessayez dans un instant.";
}

function ResendButton({ initialSeconds, pending }: { initialSeconds: number; pending: boolean }) {
  const remaining = useCountdown(initialSeconds);
  return (
    <Button type="submit" variant="secondary" disabled={remaining > 0} loading={pending}>
      {remaining > 0 ? `Renvoyer le message dans ${String(remaining)} s` : "Renvoyer le message"}
    </Button>
  );
}

export function VerificationEmailScreen() {
  const context = useReturnContext();
  const status = useVerificationStatus();
  const resend = useResendVerification();
  const rememberedEmail = useRememberedVerificationEmail();
  const [outcome, setOutcome] = useState<ResendOutcome | null>(null);
  const [cooldown, setCooldown] = useState<Cooldown | null>(null);
  const form = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });

  const send = async (email: string) => {
    setOutcome(null);
    const restart = (seconds: number) => { setCooldown((previous) => ({ seconds, id: (previous?.id ?? 0) + 1 })); };
    try {
      const result = await resend.mutateAsync(email);
      if (result.status === "rate_limited") {
        setOutcome({ kind: "limited", seconds: result.retryAfterSeconds });
        restart(result.retryAfterSeconds);
        return;
      }
      setOutcome({ kind: "sent" });
      restart(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      setOutcome({ kind: "failed", message: resendProblem(error) });
    }
  };

  const submit = rememberedEmail === null
    ? form.handleSubmit((values) => send(values.email))
    : (event: SyntheticEvent) => {
        event.preventDefault();
        return send(rememberedEmail);
      };

  return (
    <StatusScreen
      icon={MailCheck}
      title="Vérifiez vos e-mails"
      description="Si l’adresse saisie peut être utilisée, un message de confirmation vient de lui être envoyé. Le lien est valable 60 minutes."
    >
      {outcome?.kind === "sent" ? (
        <FormAlert tone="success" title="Message renvoyé.">
          Consultez votre boîte de réception et vos courriers indésirables.
        </FormAlert>
      ) : null}
      {outcome?.kind === "limited" ? (
        <FormAlert tone="warning" title="Trop de demandes." focusOnMount>
          Réessayez dans {formatDuration(outcome.seconds)}. Le dernier message reste valable 60 minutes.
        </FormAlert>
      ) : null}
      {outcome?.kind === "failed" ? (
        <FormAlert tone="danger" title="Envoi impossible pour le moment." focusOnMount>
          {outcome.message}
        </FormAlert>
      ) : null}
      <form noValidate onSubmit={(event) => { void submit(event); }} className="flex flex-col gap-3">
        {rememberedEmail === null ? (
          <TextField
            label="E-mail *"
            type="email"
            placeholder="prenom.nom@exemple.fr"
            hint="Saisissez l’adresse utilisée à l’inscription."
            autoComplete="email"
            inputMode="email"
            error={form.formState.errors.email?.message}
            {...form.register("email")}
          />
        ) : null}
        <ResendButton
          key={cooldown?.id ?? 0}
          initialSeconds={cooldown?.seconds ?? status.data?.resendAvailableInSeconds ?? 0}
          pending={resend.isPending}
        />
      </form>
      <AltLine>
        Mauvaise adresse ? <TextLink href={context.to(ROUTES.inscription)}>Recommencer l’inscription</TextLink>
      </AltLine>
      <DemoNotice>
        Simuler le clic sur le lien du message :{" "}
        <TextLink href={`${ROUTES.verificationEmail}/confirmer?jeton=valide`}>lien valide</TextLink>{" "}
        <TextLink href={`${ROUTES.verificationEmail}/confirmer?jeton=expire`}>lien expiré</TextLink>
      </DemoNotice>
    </StatusScreen>
  );
}

export function ConfirmerEmailScreen() {
  const router = useRouter();
  const { jeton: token } = useConsumedParams(VERIFICATION_LINK_PARAMS);
  const verify = useVerifyEmail();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);
  const { mutateAsync } = verify;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    mutateAsync(token)
      .then((result) => {
        if (result.status === "verified") forgetVerificationEmail();
        router.replace(result.status === "verified" ? "/email-verifie" : `${ROUTES.lienExpire}?type=verification`);
      })
      .catch(() => { setFailed(true); });
  }, [token, mutateAsync, router]);

  return (
    <AuthCard label="Vérification de votre adresse" centered>
      {failed ? (
        <FormAlert tone="danger" title="Vérification impossible pour le moment." focusOnMount>
          Le serveur n’a pas pu confirmer votre adresse. Votre lien reste utilisable : rechargez la page dans un instant.
        </FormAlert>
      ) : (
        <>
          <Spinner size={32} label="Vérification de votre adresse" />
          <p className="text-body text-fg-muted">Vérification de votre adresse en cours…</p>
        </>
      )}
    </AuthCard>
  );
}
