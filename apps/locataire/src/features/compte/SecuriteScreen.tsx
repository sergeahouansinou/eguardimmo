'use client';

import { authUrl } from '@eguardimmo/shell';
import { Alert, Button } from '@eguardimmo/ui';
import { KeyRound, Link2, ShieldCheck, Smartphone } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { ACCOUNT_TABS, RouteTabs } from '@/components/RouteTabs';
import { Async } from '@/components/ScreenState';
import { ListRow, SectionCard } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import { useSecurity } from '@/data/queries';
import type { Security } from '@/data/schemas/compte';
import { formatDate } from '@/lib/dates';

export function SecuriteScreen() {
  const security = useSecurity();
  const manageHref = authUrl('/compte/securite');
  return (
    <>
      <PageHeader
        title="Sécurité"
        crumbs={[{ label: 'Mes informations', href: '/compte' }, { label: 'Sécurité' }]}
        subtitle="Résumé de la sécurité de votre compte, commun à tous vos espaces."
        actions={
          <Button asChild>
            <a href={manageHref}>Gérer dans Mon compte</a>
          </Button>
        }
      />
      <RouteTabs label="Mon compte" tabs={ACCOUNT_TABS} />
      <Alert tone="info" title="La sécurité se gère dans Mon compte">
        Mot de passe, double authentification et appareils sont les mêmes pour tous vos espaces eGuardImmo. Après vos modifications, vous revenez ici.
      </Alert>
      <Async query={security} errorTitle="Le résumé de sécurité n’a pas pu être chargé" rows={1}>
        {(data) => <SecurityList data={data} />}
      </Async>
    </>
  );
}

function SecurityList({ data }: { data: Security }) {
  const manageHref = authUrl('/compte/securite');
  const linked = [data.google, data.apple].filter(Boolean).length;
  return (
    <SectionCard
      id="se-resume"
      title="Sécurité de votre compte"
      aside={
        <Button variant="secondary" size="sm" asChild>
          <a href={manageHref}>Gérer dans Mon compte</a>
        </Button>
      }
    >
      <ul>
        <ListRow
          icon={KeyRound}
          title="Mot de passe"
          detail={`Modifié le ${formatDate(data.passwordChangedOn)}`}
          trailing={<StatusBadge tone="success">{data.passwordStrength}</StatusBadge>}
        />
        <ListRow
          icon={ShieldCheck}
          title="Double authentification"
          detail={`${data.twoFactor.method} · ${String(data.twoFactor.backupCodesLeft)} codes de secours restants sur ${String(data.twoFactor.backupCodesTotal)}`}
          trailing={<StatusBadge tone={data.twoFactor.enabled ? 'success' : 'warning'}>{data.twoFactor.enabled ? 'Activée' : 'Désactivée'}</StatusBadge>}
        />
        <ListRow
          icon={Link2}
          title="Comptes liés"
          detail={`Google ${data.google ? 'lié' : 'non lié'} · Apple ${data.apple ? 'lié' : 'non lié'}`}
          trailing={<StatusBadge tone="neutral">{`${String(linked)} lié`}</StatusBadge>}
        />
        <ListRow
          icon={Smartphone}
          title="Appareils connectés"
          detail={`${String(data.devices)} appareils, dont cet appareil`}
          trailing={<StatusBadge tone="neutral">{String(data.devices)}</StatusBadge>}
        />
      </ul>
    </SectionCard>
  );
}
