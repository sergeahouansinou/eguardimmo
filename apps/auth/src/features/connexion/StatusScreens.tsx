"use client";

import { BadgeCheck, Clock, LogOut, ShieldCheck, Trash2, TriangleAlert, UserX } from "lucide-react";
import { Alert, Button, Spinner } from "@eguardimmo/ui";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { ButtonLink, AltLine, TextLink } from "@/components/TextLink";
import { StatusScreen } from "@/components/StatusScreen";
import { useSession, useSignOut } from "@/features/auth/queries";
import { providerSchema } from "@/features/auth/schemas";
import type { SocialProvider } from "@/features/auth/schemas";
import { useReturnContext } from "@/features/auth/useReturnContext";
import { parseReturnTo } from "@/lib/returnTo";
import { ROUTES } from "@/lib/routes";

const PROVIDER_LABELS: Record<SocialProvider, string> = { google: "Google", apple: "Apple" };

function useProvider(): SocialProvider {
  const parsed = providerSchema.safeParse(useSearchParams().get("fournisseur"));
  return parsed.success ? parsed.data : "google";
}

export function CompteInconnuScreen() {
  const context = useReturnContext();
  const provider = useProvider();
  return (
    <StatusScreen
      icon={UserX}
      tone="warning"
      title="Aucun compte trouvé"
      description={`Aucun compte eGuardImmo n’est associé à ce compte ${PROVIDER_LABELS[provider]}. Vous pouvez en créer un en quelques instants.`}
    >
      <ButtonLink href={context.to(ROUTES.inscription)}>Créer un compte avec {PROVIDER_LABELS[provider]}</ButtonLink>
      <ButtonLink href={context.to(ROUTES.connexion)} variant="secondary">
        Retour à la connexion
      </ButtonLink>
    </StatusScreen>
  );
}

export function LiaisonRequiseScreen() {
  const context = useReturnContext();
  const provider = useProvider();
  return (
    <StatusScreen
      icon={TriangleAlert}
      tone="warning"
      title="Un compte existe déjà avec cet e-mail"
      description={`Pour votre sécurité, connectez-vous d’abord avec votre mot de passe. Vous pourrez ensuite lier ${PROVIDER_LABELS[provider]} depuis la sécurité de votre compte.`}
    >
      <ButtonLink href={context.to(ROUTES.connexion)}>Me connecter avec mon mot de passe</ButtonLink>
      <AltLine>
        <TextLink href={context.to(ROUTES.motDePasseOublie)}>Mot de passe oublié ?</TextLink>
      </AltLine>
    </StatusScreen>
  );
}

export function RetourRefuseScreen() {
  const raw = useSearchParams().get("adresse");
  const parsed = parseReturnTo(raw);
  const origin = parsed.status === "refused" ? parsed.origin : null;
  return (
    <StatusScreen
      icon={TriangleAlert}
      tone="danger"
      title="Adresse de retour refusée"
      description={
        origin
          ? `Le lien suivi demandait une redirection vers un site inconnu (${origin}). Vous restez sur eGuardImmo.`
          : "Le lien suivi demandait une redirection vers une adresse non reconnue. Vous restez sur eGuardImmo."
      }
    >
      <ButtonLink href={ROUTES.profils}>Accéder à mes espaces</ButtonLink>
    </StatusScreen>
  );
}

export function SessionExpireeScreen() {
  const context = useReturnContext();
  return (
    <StatusScreen
      icon={Clock}
      tone="warning"
      title="Votre session a expiré"
      description="Par sécurité, vous avez été déconnecté après une longue période d’inactivité. Reconnectez-vous pour reprendre."
    >
      <ButtonLink href={context.to(ROUTES.connexion)}>Me reconnecter</ButtonLink>
    </StatusScreen>
  );
}

export function DeconnecteScreen() {
  const session = useSession();
  const signOut = useSignOut();
  const started = useRef(false);
  const { mutate } = signOut;

  useEffect(() => {
    if (session.data && !started.current) {
      started.current = true;
      mutate(undefined);
    }
  }, [session.data, mutate]);

  if (session.isError || signOut.isError) {
    return (
      <div className="flex flex-col gap-3">
        <Alert tone="danger" title="La déconnexion a échoué">
          Votre session n’a pas pu être fermée. Réessayez avant de quitter cet appareil.
        </Alert>
        <Button
          className="self-start"
          onClick={() => {
            if (session.isError) session.refetch();
            else mutate(undefined);
          }}
        >
          Réessayer
        </Button>
      </div>
    );
  }

  if (session.data !== null) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size={32} label="Fermeture de votre session" />
      </div>
    );
  }

  return (
    <StatusScreen
      icon={LogOut}
      tone="info"
      title="Vous êtes déconnecté"
      description="Votre session a été fermée sur tous les espaces eGuardImmo de cet appareil."
    >
      <ButtonLink href={ROUTES.connexion}>Me reconnecter</ButtonLink>
    </StatusScreen>
  );
}

export function EmailVerifieScreen() {
  const context = useReturnContext();
  return (
    <StatusScreen
      icon={BadgeCheck}
      tone="success"
      title="E-mail vérifié"
      description="Connectez-vous pour accéder à votre espace."
    >
      <ButtonLink href={context.to(ROUTES.connexion)}>Me connecter</ButtonLink>
    </StatusScreen>
  );
}

export function LienExpireScreen() {
  const type = useSearchParams().get("type");
  if (type === "verification") {
    return (
      <StatusScreen
        icon={Clock}
        tone="warning"
        title="Lien de confirmation invalide"
        description="Ce lien est invalide, expiré (60 minutes) ou déjà utilisé. Si vous avez déjà confirmé votre adresse, connectez-vous."
      >
        <ButtonLink href={ROUTES.connexion}>Me connecter</ButtonLink>
        <AltLine>
          Pas encore de confirmation ? <TextLink href={ROUTES.verificationEmail}>Revenir à la vérification</TextLink>
        </AltLine>
      </StatusScreen>
    );
  }
  return (
    <StatusScreen
      icon={Clock}
      tone="warning"
      title="Ce lien a expiré"
      description="Les liens de réinitialisation ne sont valables qu’un temps limité et une seule fois."
    >
      <ButtonLink href={ROUTES.motDePasseOublie}>Recevoir un nouveau lien</ButtonLink>
      <AltLine>
        <TextLink href={ROUTES.connexion}>Retour à la connexion</TextLink>
      </AltLine>
    </StatusScreen>
  );
}

export function MotDePasseModifieScreen() {
  return (
    <StatusScreen
      icon={ShieldCheck}
      tone="success"
      title="Mot de passe modifié"
      description="Par sécurité, vous avez été déconnecté de tous vos appareils. Reconnectez-vous avec votre nouveau mot de passe."
    >
      <ButtonLink href={ROUTES.connexion}>Me connecter</ButtonLink>
    </StatusScreen>
  );
}

export function CompteSupprimeScreen() {
  return (
    <StatusScreen
      icon={Trash2}
      tone="info"
      title="Compte supprimé"
      description="Votre compte a été anonymisé et vous avez été déconnecté de tous vos appareils. Les documents légaux déjà émis sont conservés."
    >
      <ButtonLink href={ROUTES.connexion} variant="secondary">
        Retour à la connexion
      </ButtonLink>
    </StatusScreen>
  );
}
