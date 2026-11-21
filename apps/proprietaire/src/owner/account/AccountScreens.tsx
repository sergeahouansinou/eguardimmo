"use client";

import { AccountIdentityPanel, AccountSecurityPanel } from "@eguardimmo/shell";
import { Alert, Button, Icon } from "@eguardimmo/ui";
import { Pencil } from "lucide-react";
import Link from "next/link";
import { confieRoutes } from "@/features/confie/routes";
import { AccountTabs } from "@/features/confie/ui/AccountTabs";
import { PageHeader } from "@/features/confie/ui/PageHeader";
import { FailureNotice, Loading } from "../screens/FailureNotice";
import { useOwnerSession } from "../session";
import { EmailChangeCard } from "./EmailChangeCard";
import { NameCard, PhoneCard } from "./IdentityCards";
import { useProfile } from "./queries";

function FicheNotice() {
  return (
    <Alert tone="info" title="Votre fiche de mandant est tenue par votre agence">
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        Adresse, représentant et pièces d’identité figurent sur la fiche de votre agence : demandez-lui toute correction par message. Le compte de paiement se change depuis son propre écran.
        <Button variant="link" size="sm" asChild>
          <Link href={confieRoutes.messageNouveau}>Écrire à l’agence</Link>
        </Button>
        <Button variant="link" size="sm" asChild>
          <Link href={confieRoutes.compteDePaiement}>Compte de paiement</Link>
        </Button>
      </span>
    </Alert>
  );
}

export function ApiInformationsScreen() {
  const { client } = useOwnerSession();
  return (
    <>
      <PageHeader
        title="Mes informations"
        crumbs={[{ label: "Mes informations" }, { label: "Informations" }]}
        subtitle="Votre identité et vos espaces, tels qu’ils figurent sur votre compte eGuardImmo."
        actions={
          <Button asChild>
            <Link href={confieRoutes.informationsModifier}>
              <Icon icon={Pencil} />
              Modifier mes informations
            </Link>
          </Button>
        }
      />
      <AccountTabs current="informations" />
      <FicheNotice />
      <AccountIdentityPanel client={client} />
    </>
  );
}

export function ApiSecuriteScreen() {
  const { client } = useOwnerSession();
  return (
    <>
      <PageHeader
        title="Sécurité"
        crumbs={[{ label: "Mes informations" }, { label: "Sécurité" }]}
        subtitle="Mot de passe, double authentification et appareils sont communs à tous vos espaces eGuardImmo."
      />
      <AccountTabs current="securite" />
      <AccountSecurityPanel client={client} />
    </>
  );
}

export function ApiModifierScreen() {
  const profile = useProfile();
  return (
    <>
      <PageHeader
        title="Modifier mes informations"
        crumbs={[{ label: "Mes informations", href: confieRoutes.informations }, { label: "Modifier" }]}
        subtitle="Ces informations sont celles de votre compte. Un changement d’adresse e-mail est confirmé par un code ; l’adresse e-mail et le téléphone demandent de confirmer votre identité."
      />
      <AccountTabs current="informations" />
      <FicheNotice />
      {profile.data === undefined ? (
        profile.isError ? (
          <FailureNotice title="Vos informations n’ont pas pu être chargées" error={profile.error} onRetry={() => void profile.refetch()} />
        ) : (
          <Loading label="Chargement de vos informations" rows={2} />
        )
      ) : (
        <>
          <NameCard profile={profile.data} />
          <PhoneCard profile={profile.data} />
          <EmailChangeCard profile={profile.data} />
          <div>
            <Button variant="secondary" asChild>
              <Link href={confieRoutes.informations}>Retour à mes informations</Link>
            </Button>
          </div>
        </>
      )}
    </>
  );
}
