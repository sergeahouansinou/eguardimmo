'use client';

import { Alert } from '@eguardimmo/ui';
import type { ReactNode } from 'react';
import { PageHeader } from '../locataires/kit';
import { links } from '../locataires/kit/links';
import { useOrgInfoSource } from '../orgapi/source';

export function LandlordOnly({ title, children }: { title: string; children: ReactNode }) {
  const { kind } = useOrgInfoSource();
  if (kind !== 'agency') return children;
  return (
    <>
      <PageHeader crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Analytique', href: '/analytique' }, { label: title }]} title={title} />
      <Alert tone="info" title="Réservé aux bailleurs autonomes">Cet écran concerne le patrimoine d’un particulier : il n’est pas ouvert à une agence.</Alert>
    </>
  );
}
