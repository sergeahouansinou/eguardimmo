"use client";

import { Alert, Badge, Button, Card, Spinner } from "@eguardimmo/ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconTile } from "@/components/IconTile";
import { TextLink } from "@/components/TextLink";
import { useProfiles, useSelectProfile, useSignOut } from "@/features/auth/queries";
import type { Profile } from "@/features/auth/schemas";
import { homeUrlOfApp } from "@/lib/returnTo";
import { redirectTo } from "@/lib/navigation";
import { ROUTES } from "@/lib/routes";
import { appOfProfile } from "@/lib/spaces";
import { PROFILE_ICONS } from "./profileIcons";
import { useSessionGuard } from "./useSessionGuard";

export function useOpenProfile() {
  const select = useSelectProfile();
  const [error, setError] = useState<string | null>(null);
  const open = async (profile: Profile) => {
    setError(null);
    const url = homeUrlOfApp(appOfProfile(profile.kind));
    if (url === null) {
      setError("L’adresse de cet espace n’est pas configurée pour cet environnement.");
      return;
    }
    try {
      await select.mutateAsync(profile.id);
      redirectTo(url);
    } catch {
      setError("Impossible d’ouvrir cet espace pour le moment. Réessayez dans un instant.");
    }
  };
  return { open, error, pending: select.isPending };
}

export function ProfileCard({ profile, onOpen, pending }: { profile: Profile; onOpen: () => void; pending: boolean }) {
  return (
    <Card aria-label={profile.title} className="gap-3 p-4">
      <div className="flex items-center gap-3">
        <IconTile icon={PROFILE_ICONS[profile.kind]} />
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-body-strong text-fg">{profile.title}</h2>
          <span className="text-caption text-fg-subtle">{profile.subtitle}</span>
        </div>
        {profile.lastUsed ? <Badge tone="info">Dernier utilisé</Badge> : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <span className="text-body text-fg-muted">{profile.summary}</span>
        {profile.badge ? <Badge tone={profile.badge.tone}>{profile.badge.label}</Badge> : null}
      </div>
      <Button
        variant={profile.lastUsed ? "primary" : "secondary"}
        loading={pending}
        onClick={onOpen}
        className="self-start"
        aria-label={`Ouvrir cet espace : ${profile.title}`}
      >
        Ouvrir cet espace
      </Button>
    </Card>
  );
}

export function ProfilsScreen() {
  const router = useRouter();
  const session = useSessionGuard();
  const profiles = useProfiles(Boolean(session.data));
  const signOut = useSignOut();
  const { open, error, pending } = useOpenProfile();
  const auto = useRef(false);
  const list = profiles.data;

  useEffect(() => {
    if (!list || auto.current) return;
    if (list.length === 0) {
      auto.current = true;
      router.replace(`${ROUTES.accesRefuse}?aucun=1`);
    } else if (list.length === 1 && list[0]) {
      auto.current = true;
      void open(list[0]);
    }
  }, [list, router, open]);

  if (profiles.isError || session.isError) {
    return (
      <div className="flex flex-col gap-3">
        <Alert tone="danger" title="Impossible de charger vos espaces">
          Une erreur est survenue. Vérifiez votre connexion puis réessayez.
        </Alert>
        <Button onClick={profiles.refetch} className="self-start">
          Réessayer
        </Button>
      </div>
    );
  }

  if (!list || !session.data) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size={32} label="Chargement de vos espaces" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-page-title">Bonjour {session.data.firstName}</h1>
        <p className="text-body text-fg-muted">
          Un compte, plusieurs profils. Choisissez l’espace à ouvrir. Vous pourrez en changer à tout moment depuis le menu du
          compte.
        </p>
      </div>
      {error ? <Alert tone="danger" title="Ouverture impossible">{error}</Alert> : null}
      {list.map((profile) => (
        <ProfileCard
          key={profile.id}
          profile={profile}
          pending={pending}
          onOpen={() => {
            void open(profile);
          }}
        />
      ))}
      <p className="text-caption text-fg-subtle">
        Chaque espace ne montre que les données de son organisation. Une connexion à votre compte vaut pour tous vos profils.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <TextLink href={ROUTES.compte}>Gérer mon compte</TextLink>
        <Button
          variant="link"
          size="sm"
          onClick={() => {
            void signOut.mutateAsync(undefined).then(() => { router.push(ROUTES.deconnecte); });
          }}
        >
          Se déconnecter
        </Button>
      </div>
    </div>
  );
}
