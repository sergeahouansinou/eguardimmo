"use client";

import { MailCheck } from "lucide-react";
import { Button, Spinner } from "@eguardimmo/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AuthCard } from "@/components/AuthCard";
import { DemoNotice } from "@/components/DemoNotice";
import { FormAlert } from "@/components/FormAlert";
import { AltLine, TextLink } from "@/components/TextLink";
import { StatusScreen } from "@/components/StatusScreen";
import { useResendVerification, useVerificationStatus, useVerifyEmail } from "@/features/auth/queries";
import { useReturnContext } from "@/features/auth/useReturnContext";
import { ROUTES } from "@/lib/routes";
import { useCountdown } from "@/lib/useCountdown";

export function VerificationEmailScreen() {
  const context = useReturnContext();
  const status = useVerificationStatus();
  const resend = useResendVerification();
  const remaining = useCountdown(status.data?.resendAvailableInSeconds ?? 0);
  const [resent, setResent] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = async () => {
    setResent(false);
    setFailed(false);
    try {
      const result = await resend.mutateAsync(undefined);
      setResent(result.status === "sent");
    } catch {
      setFailed(true);
    }
  };

  return (
    <StatusScreen
      icon={MailCheck}
      title="Vérifiez vos e-mails"
      description="Si l’adresse saisie peut être utilisée, un message de confirmation vient de lui être envoyé. Le lien est valable 60 minutes."
    >
      {resent ? (
        <FormAlert tone="success" title="Message renvoyé.">
          Consultez votre boîte de réception.
        </FormAlert>
      ) : null}
      {failed ? (
        <FormAlert tone="danger" title="Envoi impossible pour le moment." focusOnMount>
          Réessayez dans un instant.
        </FormAlert>
      ) : null}
      <Button variant="secondary" disabled={remaining > 0} loading={resend.isPending} onClick={() => { void submit(); }}>
        {remaining > 0 ? `Renvoyer le message dans ${String(remaining)} s` : "Renvoyer le message"}
      </Button>
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
  const token = useSearchParams().get("jeton") ?? "";
  const verify = useVerifyEmail();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);
  const { mutateAsync } = verify;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    mutateAsync(token)
      .then((result) => {
        router.replace(result.status === "verified" ? "/email-verifie" : `${ROUTES.lienExpire}?type=verification`);
      })
      .catch(() => { setFailed(true); });
  }, [token, mutateAsync, router]);

  return (
    <AuthCard label="Vérification de votre adresse" centered>
      {failed ? (
        <FormAlert tone="danger" title="Vérification impossible pour le moment." focusOnMount>
          Une erreur est survenue. Rechargez la page pour réessayer.
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
