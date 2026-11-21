'use client';

import { Badge, Card, CardHeader, CardTitle } from '@eguardimmo/ui';
import type { AccountPanelProps } from './AccountIdentityPanel';
import { DevicesCard } from './DevicesCard';
import { formatDate } from './format';
import type { AccountSecurity } from './model';
import { FactRow, FailureNotice, HubLink, Loading } from './parts';
import { useAccountSecurity } from './queries';

const PROVIDER_LABELS = { google: 'Google', apple: 'Apple' } as const;

function twoFactorDetail(security: AccountSecurity, timeZone: string | undefined): string {
  const { twoFactor } = security;
  if (!twoFactor.enabled) return 'Un code à usage unique s’ajoute à votre mot de passe à chaque connexion.';
  return `Activée le ${formatDate(twoFactor.enabledAt, timeZone)} · ${String(twoFactor.backupCodesRemaining)} codes de secours restants sur ${String(twoFactor.backupCodesTotal)}`;
}

function SecurityRows({ security, timeZone }: { security: AccountSecurity; timeZone: string | undefined }) {
  const linked = security.linkedAccounts.filter((account) => account.linked);
  return (
    <dl>
      <FactRow label="Adresse e-mail" action={<HubLink path="/compte/securite" label="Modifier" hint="l’adresse e-mail" />}>
        <span className="flex flex-wrap items-center gap-2">
          {security.email}
          <Badge tone={security.emailVerified ? 'success' : 'warning'}>{security.emailVerified ? 'Vérifiée' : 'Non vérifiée'}</Badge>
        </span>
      </FactRow>
      <FactRow label="Mot de passe" action={<HubLink path="/compte/securite" label="Modifier" hint="le mot de passe" />}>
        {security.hasPassword ? 'Défini' : 'Aucun mot de passe : vous vous connectez avec Google ou Apple.'}
      </FactRow>
      <FactRow
        label="Double authentification"
        action={<HubLink path="/compte/securite/double-authentification" label="Gérer" hint="la double authentification" />}
      >
        <span className="flex flex-col gap-1">
          <span>
            <Badge tone={security.twoFactor.enabled ? 'success' : 'warning'}>
              {security.twoFactor.enabled ? 'Activée' : 'Non activée'}
            </Badge>
          </span>
          <span className="text-caption text-fg-subtle">{twoFactorDetail(security, timeZone)}</span>
        </span>
      </FactRow>
      <FactRow label="Comptes liés" action={<HubLink path="/compte/comptes-lies" label="Gérer" hint="les comptes liés" />}>
        {linked.length === 0
          ? 'Aucun compte Google ou Apple lié.'
          : linked.map((account) => `${PROVIDER_LABELS[account.provider]}${account.email ? ` (${account.email})` : ''}`).join(' · ')}
      </FactRow>
    </dl>
  );
}

function ConnectionCard({ client, timeZone }: AccountPanelProps) {
  const security = useAccountSecurity(client);
  return (
    <Card role="region" aria-label="Connexion">
      <CardHeader>
        <CardTitle as="h2">Connexion</CardTitle>
      </CardHeader>
      {security.data === undefined ? (
        security.isError ? (
          <FailureNotice title="L’état de sécurité n’a pas pu être chargé" error={security.error} onRetry={() => void security.refetch()} />
        ) : (
          <Loading label="Chargement de l’état de sécurité" rows={4} />
        )
      ) : (
        <SecurityRows security={security.data} timeZone={timeZone} />
      )}
    </Card>
  );
}

function DeletionCard() {
  return (
    <Card role="region" aria-label="Suppression du compte">
      <CardHeader>
        <CardTitle as="h2">Suppression du compte</CardTitle>
      </CardHeader>
      <p className="text-body text-fg-muted">
        La suppression est définitive et vous demande de confirmer votre identité. Elle se fait dans Mon compte, qui gère cette vérification pour tous vos espaces.
      </p>
      <div>
        <HubLink path="/compte/supprimer" label="Supprimer mon compte" hint="dans Mon compte" />
      </div>
    </Card>
  );
}

export function AccountSecurityPanel({ client, timeZone }: AccountPanelProps) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ConnectionCard client={client} timeZone={timeZone} />
      <DevicesCard client={client} timeZone={timeZone} />
      <DeletionCard />
    </div>
  );
}
