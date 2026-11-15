"use client";

import { Building2, House, Plane } from "lucide-react";
import { Alert } from "@eguardimmo/ui";
import { AuthCard, AuthHeading } from "@/components/AuthCard";
import { OptionLink } from "@/components/OptionLink";
import { AltLine, TextLink } from "@/components/TextLink";
import { useReturnContext } from "@/features/auth/useReturnContext";
import { ROUTES } from "@/lib/routes";

export function InscriptionChoixScreen() {
  const context = useReturnContext();
  return (
    <AuthCard label="Créer un compte">
      <AuthHeading
        title="Créer un compte"
        description="Choisissez ce qui vous correspond. Votre compte reste unique, vous pourrez en ajouter d’autres ensuite."
      />
      <OptionLink
        href={context.to(`${ROUTES.inscription}/bailleur`)}
        icon={House}
        title="Je suis bailleur"
        caption="Je gère mes biens moi-même. Espace propriétaire gratuit."
      />
      <OptionLink
        href={context.to(`${ROUTES.inscription}/agence`)}
        icon={Building2}
        title="Je représente une agence"
        caption="Mandats, encaissements, reversements. Essai d’un mois."
      />
      <OptionLink
        href={context.to(`${ROUTES.inscription}/voyageur`)}
        icon={Plane}
        title="Je voyage"
        caption="Compte SeBook pour réserver un séjour."
      />
      <Alert tone="info" title="Locataire ou propriétaire mandant ?">
        Votre accès vous est envoyé par invitation de votre gestionnaire ou de votre agence.
      </Alert>
      <AltLine>
        Déjà un compte ? <TextLink href={context.to(ROUTES.connexion)}>Se connecter</TextLink>
      </AltLine>
    </AuthCard>
  );
}
