'use client';

import { Alert, Button } from '@eguardimmo/ui';
import type { ReactNode } from 'react';
import { PageHeader, useGestionNavigation } from '../../../locataires/kit';
import { links } from '../../../locataires/kit/links';
import { useChargesPermissions } from '../hooks';
import { chargesPaths } from '../paths';

const SECTIONS = [
  { id: 'expenses', label: 'Dépenses', href: chargesPaths.expenses },
  { id: 'exercises', label: 'Régularisation', href: chargesPaths.exercises },
  { id: 'keys', label: 'Clés de répartition', href: chargesPaths.keys },
] as const;

export type ChargesSection = (typeof SECTIONS)[number]['id'];

export function ChargesSections({ current }: { current: ChargesSection }) {
  const { Link } = useGestionNavigation();
  return (
    <nav aria-label="Sections des charges" className="flex flex-wrap gap-2">
      {SECTIONS.map((section) => (
        <Button key={section.id} variant={section.id === current ? 'primary' : 'secondary'} size="sm" asChild>
          <Link href={section.href} aria-current={section.id === current ? 'page' : undefined}>{section.label}</Link>
        </Button>
      ))}
    </nav>
  );
}

export function ChargesGate({ children }: { children: ReactNode }) {
  const permissions = useChargesPermissions();
  if (permissions.available) return children;
  return (
    <>
      <PageHeader crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Charges' }]} title="Charges locatives" />
      <Alert tone="info" title="Charges indisponibles pour ce compte">
        Les dépenses et la régularisation des charges sont réservées au propriétaire, à l’administrateur, au gestionnaire et au comptable de l’organisation.
      </Alert>
    </>
  );
}

export function RoleNotice({ children }: { children: ReactNode }) {
  return <p className="text-caption text-fg-subtle">{children}</p>;
}
