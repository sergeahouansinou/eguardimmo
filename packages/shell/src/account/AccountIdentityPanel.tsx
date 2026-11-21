'use client';

import type { ApiClient } from '@eguardimmo/api';
import { Badge, Card, CardHeader, CardTitle, EmptyState } from '@eguardimmo/ui';
import { UsersRound } from 'lucide-react';
import { formatDateTime, profileKind } from './format';
import { FactRow, FailureNotice, HubLink, Loading } from './parts';
import { useAccountIdentity, useAccountProfiles } from './queries';

export interface AccountPanelProps {
  client: ApiClient;
  timeZone?: string;
}

function IdentityCard({ client, timeZone }: AccountPanelProps) {
  const identity = useAccountIdentity(client);
  return (
    <Card role="region" aria-label="Identité">
      <CardHeader>
        <CardTitle as="h2">Identité</CardTitle>
      </CardHeader>
      {identity.data === undefined ? (
        identity.isError ? (
          <FailureNotice title="Votre identité n’a pas pu être chargée" error={identity.error} onRetry={() => void identity.refetch()} />
        ) : (
          <Loading label="Chargement de votre identité" />
        )
      ) : (
        <>
          <dl>
            <FactRow label="Nom">{identity.data.name}</FactRow>
            <FactRow
              label="Adresse e-mail"
              action={<HubLink path="/compte/securite" label="Modifier" hint="l’adresse e-mail" />}
            >
              <span className="flex flex-wrap items-center gap-2">
                {identity.data.email}
                <Badge tone={identity.data.emailVerifiedAt === null ? 'warning' : 'success'}>
                  {identity.data.emailVerifiedAt === null ? 'Non vérifiée' : 'Vérifiée'}
                </Badge>
              </span>
            </FactRow>
            <FactRow label="Dernière connexion">{formatDateTime(identity.data.lastLoginAt, timeZone)}</FactRow>
            <FactRow label="Connexion précédente">{formatDateTime(identity.data.previousLoginAt, timeZone)}</FactRow>
          </dl>
          <p className="text-caption text-fg-subtle">
            Le nom, commun à tous vos espaces eGuardImmo, n’est pas modifiable depuis cette page. L’adresse e-mail se change dans Mon compte.
          </p>
        </>
      )}
    </Card>
  );
}

function ProfilesCard({ client }: Pick<AccountPanelProps, 'client'>) {
  const profiles = useAccountProfiles(client);
  return (
    <Card role="region" aria-label="Mes espaces">
      <CardHeader>
        <CardTitle as="h2">Mes espaces</CardTitle>
        <HubLink path="/profils" label="Changer d’espace" hint="depuis la liste de vos espaces" />
      </CardHeader>
      {profiles.data === undefined ? (
        profiles.isError ? (
          <FailureNotice title="Vos espaces n’ont pas pu être chargés" error={profiles.error} onRetry={() => void profiles.refetch()} />
        ) : (
          <Loading label="Chargement de vos espaces" rows={2} />
        )
      ) : profiles.data.length === 0 ? (
        <EmptyState icon={UsersRound} title="Aucun espace" description="Votre compte n’est rattaché à aucun espace pour le moment." />
      ) : (
        <ul>
          {profiles.data.map((profile, index) => (
            <li key={`${profile.space}-${profile.label}-${String(index)}`} className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-line py-2 first:pt-0 last:border-b-0 last:pb-0">
              <span className="min-w-0 text-body text-fg [overflow-wrap:anywhere]">{profile.label}</span>
              <span className="text-caption text-fg-subtle">{profileKind(profile)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function AccountIdentityPanel({ client, timeZone }: AccountPanelProps) {
  return (
    <div className="grid min-w-0 grid-cols-1 items-start gap-3 lg:grid-cols-2">
      <IdentityCard client={client} timeZone={timeZone} />
      <ProfilesCard client={client} />
    </div>
  );
}
