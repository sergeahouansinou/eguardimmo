"use client";

import { TriangleAlert } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Spinner, TextField } from "@eguardimmo/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { AuthCard, AuthHeading } from "@/components/AuthCard";
import { CheckboxField, TermsLabel } from "@/components/CheckboxField";
import { DemoNotice } from "@/components/DemoNotice";
import { FormAlert } from "@/components/FormAlert";
import { PasswordField } from "@/components/PasswordField";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import { SocialButtons } from "@/components/SocialButtons";
import { StatusScreen } from "@/components/StatusScreen";
import { AltLine, ButtonLink } from "@/components/TextLink";
import { useAcceptInvitation, useInvitation, useSocialSignIn } from "@/features/auth/queries";
import { invitationSchema } from "@/features/auth/schemas";
import type { InvitationDetail, InvitationValues } from "@/features/auth/schemas";
import { formatDate } from "@/lib/format";
import { PASSWORD_PLACEHOLDER } from "@/lib/password";
import { ROUTES } from "@/lib/routes";

function copyFor(invitation: InvitationDetail) {
  if (invitation.kind === "locataire") {
    return {
      title: "Activer mon espace locataire",
      description: `${invitation.organisation} vous invite à suivre votre logement, ${invitation.reference}, en ligne.`,
    };
  }
  return {
    title: "Activer mon espace propriétaire",
    description: `${invitation.organisation} vous invite à suivre vos biens et vos reversements, mandat ${invitation.reference}.`,
  };
}

function InvitationForm({ token, invitation }: { token: string; invitation: InvitationDetail }) {
  const router = useRouter();
  const accept = useAcceptInvitation();
  const socialSignIn = useSocialSignIn();
  const [problem, setProblem] = useState(false);
  const [activated, setActivated] = useState(false);
  const form = useForm<InvitationValues>({
    resolver: zodResolver(invitationSchema),
    defaultValues: { password: "", acceptTerms: false },
  });
  const password = useWatch({ control: form.control, name: "password" });
  const { setFocus } = form;
  useEffect(() => {
    setFocus("password");
  }, [setFocus]);

  const copy = copyFor(invitation);
  const errors = form.formState.errors;

  const submit = form.handleSubmit(async (values) => {
    setProblem(false);
    try {
      const result = await accept.mutateAsync({ token, password: values.password });
      if (result.status === "activated") {
        setActivated(true);
        router.push(`${ROUTES.connexion}?activation=1`);
      } else {
        setProblem(true);
      }
    } catch {
      setProblem(true);
    }
  });

  if (activated) {
    return (
      <AuthCard label="Activation en cours" centered>
        <Spinner size={32} label="Activation de votre espace" />
        <p className="text-body text-fg-muted">Activation de votre espace…</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard label={copy.title}>
      <AuthHeading title={copy.title} description={copy.description} />
      {problem ? (
        <FormAlert tone="danger" title="Activation impossible pour le moment." focusOnMount>
          Une erreur est survenue. Réessayez dans un instant.
        </FormAlert>
      ) : null}
      <form noValidate onSubmit={(event) => { void submit(event); }} className="flex flex-col gap-4">
        <TextField label="E-mail" type="email" placeholder="prenom.nom@exemple.fr" autoComplete="username" value={invitation.email} readOnly />
        <PasswordField
          label="Mot de passe *"
          placeholder={PASSWORD_PLACEHOLDER}
          autoComplete="new-password"
          error={errors.password?.message}
          {...form.register("password")}
        />
        <PasswordStrengthMeter value={password} />
        <CheckboxField label={<TermsLabel />} error={errors.acceptTerms?.message} {...form.register("acceptTerms")} />
        <Button type="submit" loading={form.formState.isSubmitting} className="w-full">
          Activer mon espace
        </Button>
      </form>
      <SocialButtons
        verb="Activer avec"
        intent="invitation"
        busy={socialSignIn.isPending}
        onPick={(provider, identityId) => {
          void socialSignIn
            .mutateAsync({ provider, intent: "invitation", identityId, invitationToken: token })
            .then((result) => {
              if (result.status === "authenticated") router.push(ROUTES.profils);
              else router.push(`${ROUTES.connexion}/liaison-requise?fournisseur=${provider}`);
            })
            .catch(() => { setProblem(true); });
        }}
      />
      <AltLine>Cette invitation est valable jusqu’au {formatDate(invitation.expiresAt)}.</AltLine>
      <DemoNotice>Invitations de démonstration : /invitation/locataire-koffi et /invitation/proprietaire-marc.</DemoNotice>
    </AuthCard>
  );
}

export function InvitationScreen({ token }: { token: string }) {
  const query = useInvitation(token);

  if (query.isError) {
    return (
      <FormAlert tone="danger" title="Impossible de vérifier l’invitation">
        Une erreur est survenue. Rechargez la page pour réessayer.
      </FormAlert>
    );
  }
  if (!query.data) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size={32} label="Vérification de l’invitation" />
      </div>
    );
  }
  if (query.data.status === "invalid") {
    return (
      <StatusScreen
        icon={TriangleAlert}
        tone="warning"
        title="Invitation expirée ou déjà utilisée"
        description="Demandez à votre gestionnaire de vous renvoyer une invitation. Si vous avez déjà activé votre espace, connectez-vous."
      >
        <ButtonLink href={ROUTES.connexion}>Me connecter</ButtonLink>
      </StatusScreen>
    );
  }
  return <InvitationForm token={token} invitation={query.data.invitation} />;
}
