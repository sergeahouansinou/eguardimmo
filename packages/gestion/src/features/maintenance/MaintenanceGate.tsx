'use client';

import { Alert } from '@eguardimmo/ui';
import type { ReactNode } from 'react';
import { PageHeader } from '../locataires/kit';
import { links } from '../locataires/kit/links';
import { useMaintenancePermissions } from './hooks';

export function MaintenanceGate({ children }: { children: ReactNode }) {
  const permissions = useMaintenancePermissions();
  if (permissions.available) return children;
  return (
    <>
      <PageHeader crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Interventions' }]} title="Interventions" />
      <Alert tone="info" title="Interventions indisponibles pour ce compte">
        Votre rôle ou votre organisation ne donne pas accès aux interventions.
      </Alert>
    </>
  );
}
