"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, TextField } from "@eguardimmo/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { AuthCard, AuthHeading } from "@/components/AuthCard";
import { ContextBanner } from "@/components/ContextBanner";
import { DemoNotice } from "@/components/DemoNotice";
import { FormAlert } from "@/components/FormAlert";
import { PasswordField } from "@/components/PasswordField";
import { SocialButtons } from "@/components/SocialButtons";
import { AltLine, TextLink } from "@/components/TextLink";
import { useSession, useSignIn, useSocialSignIn } from "@/features/auth/queries";
import { signInSchema } from "@/features/auth/schemas";
import type { SignInValues } from "@/features/auth/schemas";
import { useReturnContext } from "@/features/auth/useReturnContext";
import { formatDuration } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { useCountdown } from "@/lib/useCountdown";
import { useSocialOutcome } from "./SocialOutcome";

type Failure = "credentials" | "locked" | "technical" | null;

export function ConnexionScreen() {
  const router = useRouter();
  const activated = useSearchParams().get("activation") === "1";
  const context = useReturnContext();
  const session = useSession();
  const signIn = useSignIn();
  const socialSignIn = useSocialSignIn();
  const onSocial = useSocialOutcome(context);
  const [failure, setFailure] = useState<Failure>(null);
  const [lockSeconds, setLockSeconds] = useState(0);
  const remaining = useCountdown(lockSeconds);
  const locked = failure === "locked" && remaining > 0;

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const { setFocus } = form;
  useEffect(() => {
    setFocus("email");
  }, [setFocus]);

  const { returnTo, rawReturnTo, afterAuthentication } = context;
  useEffect(() => {
    if (returnTo.status === "refused") {
      router.replace(`${ROUTES.retourRefuse}?adresse=${encodeURIComponent(rawReturnTo ?? "")}`);
    } else if (session.data) {
      afterAuthentication();
    }
  }, [returnTo.status, rawReturnTo, session.data, router, afterAuthentication]);

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      const result = await signIn.mutateAsync(values);
      if (result.status === "authenticated") {
        afterAuthentication();
      } else if (result.status === "two_factor_required") {
        router.push(context.to(`${ROUTES.connexion}/verification`));
      } else if (result.status === "locked") {
        setLockSeconds(result.retryAfterSeconds);
        setFailure("locked");
        form.resetField("password");
      } else {
        setFailure("credentials");
        form.resetField("password");
      }
    } catch {
      setFailure("technical");
    }
  });

  const socialBusy = socialSignIn.isPending;

  return (
    <AuthCard label="Connexion">
      <AuthHeading title="Connexion" description="Un seul compte pour tous vos espaces eGuardImmo." />
      {context.spaceLabel ? <ContextBanner spaceLabel={context.spaceLabel} /> : null}
      {activated ? (
        <FormAlert tone="success" title="Votre espace est activé.">
          Connectez-vous avec votre adresse e-mail et le mot de passe choisi.
        </FormAlert>
      ) : null}
      {failure === "credentials" ? (
        <FormAlert tone="danger" title="E-mail ou mot de passe incorrect." focusOnMount>
          Le message est le même que le compte existe ou non.
        </FormAlert>
      ) : null}
      {locked ? (
        <FormAlert tone="warning" title="Trop de tentatives.">
          Réessayez dans {formatDuration(remaining)}, ou réinitialisez votre mot de passe.
        </FormAlert>
      ) : null}
      {failure === "technical" ? (
        <FormAlert tone="danger" title="Connexion impossible pour le moment." focusOnMount>
          Une erreur est survenue. Réessayez dans un instant.
        </FormAlert>
      ) : null}
      <form noValidate onSubmit={(event) => { void submit(event); }} className="flex flex-col gap-4">
        <TextField
          label="E-mail *"
          type="email"
          placeholder="prenom.nom@exemple.fr"
          autoComplete="username"
          inputMode="email"
          error={form.formState.errors.email?.message}
          {...form.register("email")}
        />
        <div className="flex flex-col gap-1">
          <PasswordField
            label="Mot de passe *"
            placeholder="Votre mot de passe"
            autoComplete="current-password"
            error={form.formState.errors.password?.message}
            {...form.register("password")}
          />
          <div className="flex justify-end">
            <TextLink href={context.to(ROUTES.motDePasseOublie)}>Mot de passe oublié ?</TextLink>
          </div>
        </div>
        <Button type="submit" loading={form.formState.isSubmitting} disabled={locked} className="w-full">
          Se connecter
        </Button>
      </form>
      <SocialButtons
        verb="Continuer avec"
        intent="connexion"
        busy={socialBusy}
        onPick={(provider, identityId) => {
          void socialSignIn
            .mutateAsync({ provider, intent: "connexion", identityId })
            .then((result) => { onSocial(result, provider); })
            .catch(() => { setFailure("technical"); });
        }}
      />
      <AltLine>
        Pas encore de compte ? <TextLink href={context.to(ROUTES.inscription)}>Créer un compte</TextLink>
      </AltLine>
      <AltLine>Locataire : l’accès se fait sur invitation de votre gestionnaire.</AltLine>
      <DemoNotice>
        Comptes de démonstration, mot de passe MotDePasse-2026 : koffi.adjovi@example.com (double authentification, code
        481305), marc.chevalier@example.com (3 profils), sophie.delmas@delmas-immobilier.example (agence),
        sans-profil@example.com (aucun espace). Cinq erreurs consécutives verrouillent la connexion 14 minutes.
      </DemoNotice>
    </AuthCard>
  );
}
