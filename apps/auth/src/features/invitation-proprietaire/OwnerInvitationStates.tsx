"use client";

import { BadgeCheck, MailWarning, TriangleAlert, UserRoundX } from "lucide-react";
import { Button } from "@eguardimmo/ui";
import Link from "next/link";
import { DemoNotice } from "@/components/DemoNotice";
import { FormAlert } from "@/components/FormAlert";
import { StatusScreen } from "@/components/StatusScreen";
import { AltLine, ButtonLink } from "@/components/TextLink";
import { DEMO_OWNER_CODES, DEMO_OWNER_TOKENS } from "@/features/auth/demoOwnerInvitations";
import type { OwnerRole } from "@/features/auth/ownerInvitationSchemas";
import { parseReturnTo } from "@/lib/returnTo";
import { ROUTES, withContext } from "@/lib/routes";
import { destinationOfProfile } from "@/lib/spaceLinks";
import { INVALID_INVITATION_MESSAGE, ROLE_LABELS } from "./ownerInvitationCopy";

const RESUME = { suite: ROUTES.invitationProprietaire };

const DEMO_LINKS = [
  { token: DEMO_OWNER_TOKENS.alex, code: DEMO_OWNER_CODES.alex, label: "Alex Martin (sans-profil@example.com) : titulaire, premier espace" },
  { token: DEMO_OWNER_TOKENS.marc, code: DEMO_OWNER_CODES.marc, label: "Marc Chevalier (marc.chevalier@example.com) : représentant" },
  { token: DEMO_OWNER_TOKENS.expiree, code: null, label: "Invitation expirée" },
] as const;

export function InvalidInvitationScreen() {
  return (
    <StatusScreen icon={TriangleAlert} tone="warning" title="Invitation invalide" description={INVALID_INVITATION_MESSAGE}>
      <ButtonLink href={ROUTES.connexion}>Me connecter</ButtonLink>
    </StatusScreen>
  );
}

export function SignedOutScreen() {
  return (
    <StatusScreen
      icon={MailWarning}
      tone="info"
      title="Invitation à votre espace propriétaire"
      description="Votre agence vous invite à rattacher votre compte eGuardImmo à votre mandat. Connectez-vous ou créez votre compte avec l’adresse e-mail qui a reçu l’invitation : vous verrez qui vous invite avant d’accepter."
    >
      <ButtonLink href={withContext(ROUTES.connexion, RESUME)}>Me connecter</ButtonLink>
      <ButtonLink href={withContext(ROUTES.inscription, RESUME)} variant="secondary">
        Créer mon compte
      </ButtonLink>
      <AltLine>Le compte doit porter l’adresse e-mail invitée, une fois confirmée. Gardez aussi le code d’appariement que votre agence vous a remis hors e-mail.</AltLine>
      <DemoNotice>
        <p>Connectez-vous avec le compte indiqué (mot de passe MotDePasse-2026), puis ouvrez le lien. Le code d’appariement de démonstration est indiqué entre parenthèses.</p>
        <ul className="mt-1 flex flex-col gap-1 [overflow-wrap:anywhere]">
          {DEMO_LINKS.map((link) => (
            <li key={link.token}>
              <Link href={`${ROUTES.invitationProprietaire}/${link.token}`} className="font-medium underline underline-offset-3">
                {link.code === null ? link.label : `${link.label} (code ${link.code})`}
              </Link>
            </li>
          ))}
        </ul>
      </DemoNotice>
    </StatusScreen>
  );
}

export function EmailMismatchScreen({ email, onSignOut, pending }: { email: string; onSignOut: () => void; pending: boolean }) {
  return (
    <StatusScreen
      icon={UserRoundX}
      tone="warning"
      title="Invitation destinée à une autre adresse"
      description={
        <>
          Vous êtes connecté avec <strong className="font-semibold [overflow-wrap:anywhere]">{email}</strong>, mais cette invitation a été envoyée à une autre adresse e-mail.
          Connectez-vous avec l’adresse qui l’a reçue, après l’avoir confirmée.
        </>
      }
    >
      <Button onClick={onSignOut} loading={pending} className="w-full">
        Me déconnecter et changer de compte
      </Button>
      <ButtonLink href={ROUTES.profils} variant="secondary">
        Retour à mes espaces
      </ButtonLink>
    </StatusScreen>
  );
}

export function EmailUnverifiedScreen({ onRetry, pending }: { onRetry: () => void; pending: boolean }) {
  return (
    <StatusScreen
      icon={MailWarning}
      tone="warning"
      title="Confirmez votre adresse e-mail"
      description="Pour accepter cette invitation, l’adresse e-mail de votre compte doit être confirmée. Ouvrez le message de confirmation, puis revenez ici ou rouvrez le lien de votre invitation."
    >
      <ButtonLink href={withContext(ROUTES.verificationEmail, RESUME)}>Confirmer mon adresse</ButtonLink>
      <Button variant="secondary" onClick={onRetry} loading={pending} className="w-full">
        J’ai confirmé mon adresse
      </Button>
    </StatusScreen>
  );
}

export function SuccessScreen({ organisation, role }: { organisation: string; role: OwnerRole }) {
  const destination = destinationOfProfile("proprietaire", parseReturnTo(null));
  return (
    <StatusScreen
      icon={BadgeCheck}
      tone="success"
      title="Invitation acceptée"
      description={`Votre compte est rattaché à votre mandat chez ${organisation}, en tant que ${ROLE_LABELS[role]}. Votre espace propriétaire est prêt.`}
    >
      {destination === null ? (
        <>
          <FormAlert tone="warning" title="Adresse de l’espace propriétaire non configurée.">
            Ouvrez votre espace depuis la liste de vos espaces.
          </FormAlert>
          <ButtonLink href={ROUTES.profils}>Voir mes espaces</ButtonLink>
        </>
      ) : (
        <Button asChild className="w-full">
          <a href={destination}>Accéder à mon espace propriétaire</a>
        </Button>
      )}
    </StatusScreen>
  );
}
