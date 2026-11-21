'use client';

import { Button, Icon } from '@eguardimmo/ui';
import { AccountIdentityPanel, AccountSecurityPanel } from '@eguardimmo/shell';
import { Pencil } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { RouteTabs } from '@/components/RouteTabs';
import type { RouteTab } from '@/components/RouteTabs';
import { useTenantSession } from '@/tenant/session';

export const API_ACCOUNT_TABS: readonly RouteTab[] = [
  { label: 'Informations', href: '/compte' },
  { label: 'Sécurité', href: '/compte/securite' },
];

export function ApiInformationsScreen() {
  const { client } = useTenantSession();
  return (
    <>
      <PageHeader
        title="Mes informations"
        crumbs={[{ label: 'Mon compte' }, { label: 'Mes informations' }]}
        subtitle="Votre identité et vos espaces, tels qu’ils figurent sur votre compte eGuardImmo."
        actions={
          <Button asChild>
            <Link href="/compte/modifier">
              <Icon icon={Pencil} />
              Modifier mes informations
            </Link>
          </Button>
        }
      />
      <RouteTabs label="Mon compte" tabs={API_ACCOUNT_TABS} />
      <AccountIdentityPanel client={client} />
    </>
  );
}

export function ApiSecuriteScreen() {
  const { client } = useTenantSession();
  return (
    <>
      <PageHeader
        title="Connexion et sécurité"
        crumbs={[{ label: 'Mon compte', href: '/compte' }, { label: 'Connexion et sécurité' }]}
        subtitle="Mot de passe, double authentification et appareils sont communs à tous vos espaces eGuardImmo."
      />
      <RouteTabs label="Mon compte" tabs={API_ACCOUNT_TABS} />
      <AccountSecurityPanel client={client} />
    </>
  );
}
