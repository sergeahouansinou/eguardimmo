"use client";

import { Mail } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Spinner, TextField } from "@eguardimmo/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { AuthCard, AuthHeading } from "@/components/AuthCard";
import { DemoNotice } from "@/components/DemoNotice";
import { FormAlert } from "@/components/FormAlert";
import { PasswordField } from "@/components/PasswordField";
import { PasswordRules } from "@/components/PasswordRules";
import { StatusScreen } from "@/components/StatusScreen";
import { AltLine, ButtonLink, TextLink } from "@/components/TextLink";
import {
  useRequestPasswordDefinition,
  useRequestPasswordReset,
  useResetPassword,
  useResetTokenCheck,
} from "@/features/auth/queries";
import { forgotPasswordSchema, resetPasswordSchema } from "@/features/auth/schemas";
import type { ForgotPasswordValues, ResetPasswordValues } from "@/features/auth/schemas";
import { useReturnContext } from "@/features/auth/useReturnContext";
import { useSessionGuard } from "@/features/espaces/useSessionGuard";
import { formatDuration } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { useConsumedParams } from "@/lib/useConsumedParams";

const RESET_LINK_PARAMS = ["jeton", "email"] as const;

export function MotDePasseOublieScreen() {
  const router = useRouter();
  const context = useReturnContext();
  const request = useRequestPasswordReset();
  const [problem, setProblem] = useState<string | null>(null);
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });
  const { setFocus } = form;
  useEffect(() => {
    setFocus("email");
  }, [setFocus]);

  const submit = form.handleSubmit(async (values) => {
    setProblem(null);
    try {
      const result = await request.mutateAsync(values.email);
      if (result.status === "rate_limited") {
        setProblem(`Trop de demandes. Réessayez dans ${formatDuration(result.retryAfterSeconds)}.`);
        return;
      }
      router.push(context.to("/mot-de-passe-oublie/envoye"));
    } catch {
      setProblem("Une erreur est survenue. Réessayez dans un instant.");
    }
  });

  return (
    <AuthCard label="Mot de passe oublié">
      <AuthHeading title="Mot de passe oublié" description="Indiquez l’adresse e-mail de votre compte." />
      {problem ? (
        <FormAlert tone="danger" title="Envoi impossible" focusOnMount>
          {problem}
        </FormAlert>
      ) : null}
      <form noValidate onSubmit={(event) => { void submit(event); }} className="flex flex-col gap-4">
        <TextField
          label="E-mail *"
          type="email"
          placeholder="prenom.nom@exemple.fr"
          autoComplete="email"
          inputMode="email"
          error={form.formState.errors.email?.message}
          {...form.register("email")}
        />
        <Button type="submit" loading={form.formState.isSubmitting} className="w-full">
          Envoyer le lien
        </Button>
      </form>
      <AltLine>
        <TextLink href={context.to(ROUTES.connexion)}>Retour à la connexion</TextLink>
      </AltLine>
    </AuthCard>
  );
}

export function MotDePasseEnvoyeScreen() {
  const context = useReturnContext();
  return (
    <StatusScreen
      icon={Mail}
      title="Consultez vos e-mails"
      description="Si un compte correspond à cette adresse, un lien de réinitialisation valable 30 minutes vient d’être envoyé. Cette réponse est identique pour toute adresse."
    >
      <ButtonLink href={context.to(ROUTES.connexion)} variant="secondary">
        Retour à la connexion
      </ButtonLink>
      <DemoNotice>
        Simuler le clic sur le lien du message :{" "}
        <TextLink href="/mot-de-passe/nouveau?jeton=valide">lien valide</TextLink>{" "}
        <TextLink href="/mot-de-passe/nouveau?jeton=expire">lien expiré</TextLink>
      </DemoNotice>
    </StatusScreen>
  );
}

function ResetPasswordForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const reset = useResetPassword();
  const [problem, setProblem] = useState(false);
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmation: "" },
  });
  const password = useWatch({ control: form.control, name: "password" });
  const { setFocus, setError } = form;
  useEffect(() => {
    setFocus("password");
  }, [setFocus]);

  const submit = form.handleSubmit(async (values) => {
    setProblem(false);
    try {
      const result = await reset.mutateAsync({ token, email, password: values.password });
      if (result.status === "ok") router.push("/mot-de-passe/modifie");
      else if (result.status === "expired") router.replace(`${ROUTES.lienExpire}?type=reinitialisation`);
      else setError("password", { message: "Choisissez un mot de passe différent de l’ancien." }, { shouldFocus: true });
    } catch {
      setProblem(true);
    }
  });

  const errors = form.formState.errors;
  return (
    <AuthCard label="Nouveau mot de passe">
      <AuthHeading title="Nouveau mot de passe" description="Choisissez un mot de passe que vous n’utilisez nulle part ailleurs." />
      {problem ? (
        <FormAlert tone="danger" title="Enregistrement impossible pour le moment." focusOnMount>
          Une erreur est survenue. Réessayez dans un instant.
        </FormAlert>
      ) : null}
      <form noValidate onSubmit={(event) => { void submit(event); }} className="flex flex-col gap-4">
        <PasswordField
          label="Nouveau mot de passe *"
          placeholder="12 caractères minimum"
          autoComplete="new-password"
          error={errors.password?.message}
          {...form.register("password")}
        />
        <PasswordField
          label="Confirmation *"
          placeholder="Saisissez-le à nouveau"
          autoComplete="new-password"
          error={errors.confirmation?.message}
          {...form.register("confirmation")}
        />
        <PasswordRules value={password} extraRule="Différent de l’ancien mot de passe" />
        <Button type="submit" loading={form.formState.isSubmitting} className="w-full">
          Enregistrer le mot de passe
        </Button>
      </form>
    </AuthCard>
  );
}

export function MotDePasseNouveauScreen() {
  const router = useRouter();
  const { jeton: token, email } = useConsumedParams(RESET_LINK_PARAMS);
  const check = useResetTokenCheck(token, email);
  const expired = token === "" || check.data?.status === "expired";

  useEffect(() => {
    if (expired) router.replace(`${ROUTES.lienExpire}?type=reinitialisation`);
  }, [expired, router]);

  if (check.isError) {
    return (
      <FormAlert tone="danger" title="Impossible de vérifier le lien">
        Une erreur est survenue. Rechargez la page pour réessayer.
      </FormAlert>
    );
  }
  if (check.data?.status !== "valid") {
    return (
      <div className="flex justify-center py-10">
        <Spinner size={32} label="Vérification du lien" />
      </div>
    );
  }
  return <ResetPasswordForm token={token} email={email} />;
}

export function DefinirMotDePasseScreen() {
  const session = useSessionGuard();
  const request = useRequestPasswordDefinition();
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (!session.data) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size={32} label="Chargement de votre compte" />
      </div>
    );
  }

  const submit = async () => {
    setProblem(null);
    try {
      const result = await request.mutateAsync(undefined);
      if (result.status === "rate_limited") {
        setProblem(`Trop de demandes. Réessayez dans ${formatDuration(result.retryAfterSeconds)}.`);
        return;
      }
      setSent(true);
    } catch {
      setProblem("Une erreur est survenue. Réessayez dans un instant.");
    }
  };

  return (
    <AuthCard label="Définir un mot de passe">
      <AuthHeading
        title="Définir un mot de passe"
        description="Votre compte a été créé avec Google, il n’a pas encore de mot de passe."
      />
      <FormAlert tone="info" title="Utile pour la double authentification.">
        Un mot de passe est requis avant de l’activer. Un lien de définition vous est envoyé par e-mail.
      </FormAlert>
      {sent ? (
        <FormAlert tone="success" title="Lien envoyé.">
          Consultez vos e-mails : le lien est valable 30 minutes.
        </FormAlert>
      ) : null}
      {problem ? (
        <FormAlert tone="danger" title="Envoi impossible" focusOnMount>
          {problem}
        </FormAlert>
      ) : null}
      <TextField label="E-mail" type="email" placeholder="prenom.nom@exemple.fr" value={session.data.email} readOnly />
      <Button loading={request.isPending} onClick={() => { void submit(); }} className="w-full">
        Recevoir le lien par e-mail
      </Button>
      <AltLine>
        <TextLink href={ROUTES.compte}>Plus tard</TextLink>
      </AltLine>
      <DemoNotice>
        Simuler le clic sur le lien du message : <TextLink href="/mot-de-passe/nouveau?jeton=valide">lien valide</TextLink>
      </DemoNotice>
    </AuthCard>
  );
}
