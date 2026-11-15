"use client";

import { TriangleAlert } from "lucide-react";
import { Alert, Button, Spinner } from "@eguardimmo/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { OptionLink } from "@/components/OptionLink";
import { StatusScreen } from "@/components/StatusScreen";
import { ButtonLink } from "@/components/TextLink";
import { useProfiles, useSignOut } from "@/features/auth/queries";
import { ROUTES } from "@/lib/routes";
import { APP_LABELS } from "@/lib/spaces";
import type { AppKind } from "@/lib/spaces";
import { useOpenProfile } from "./ProfilsScreen";
import { PROFILE_ICONS } from "./profileIcons";
import { useSessionGuard } from "./useSessionGuard";

function isAppKind(value: string | null): value is AppKind {
  return value !== null && value in APP_LABELS;
}

export function AccesRefuseScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const session = useSessionGuard();
  const profiles = useProfiles(Boolean(session.data));
  const signOut = useSignOut();
  const { open, error } = useOpenProfile();
  const espace = params.get("espace");
  const list = profiles.data;

  if (!session.data || !list) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size={32} label="Vérification de vos accès" />
      </div>
    );
  }

  const logout = (
    <Button
      variant="secondary"
      onClick={() => {
        void signOut.mutateAsync(undefined).then(() => { router.push(ROUTES.deconnecte); });
      }}
    >
      Se déconnecter
    </Button>
  );

  if (list.length === 0) {
    return (
      <StatusScreen
        icon={TriangleAlert}
        tone="warning"
        title="Aucun espace rattaché à ce compte"
        description="Votre compte n’est lié à aucun espace pour le moment. Créez votre espace bailleur ou agence, ou demandez une invitation à votre gestionnaire."
      >
        <ButtonLink href={ROUTES.inscription}>Créer un espace</ButtonLink>
        {logout}
      </StatusScreen>
    );
  }

  const label = isAppKind(espace) ? APP_LABELS[espace] : "cet espace";
  return (
    <StatusScreen
      icon={TriangleAlert}
      tone="warning"
      title="Vous n’avez pas accès à cet espace"
      description={`Votre compte n’est pas rattaché à ${isAppKind(espace) ? `l’${label}` : label}. Voici les espaces auxquels vous avez droit.`}
    >
      {error ? <Alert tone="danger" title="Ouverture impossible">{error}</Alert> : null}
      <ul className="flex flex-col gap-2">
        {list.map((profile) => (
          <li key={profile.id}>
            <OptionLink
              icon={PROFILE_ICONS[profile.kind]}
              title={profile.title}
              caption={profile.subtitle}
              onClick={() => {
                void open(profile);
              }}
            />
          </li>
        ))}
      </ul>
      {logout}
    </StatusScreen>
  );
}
