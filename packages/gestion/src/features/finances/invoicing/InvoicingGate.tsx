'use client';

import { Alert } from '@eguardimmo/ui';
import type { ReactNode } from 'react';
import { useInvoicingPermissions } from './hooks';
import { AGENCY_ONLY_MESSAGE } from './api/invoicingErrors';
import { PageHeader } from '../../locataires/kit';
import { links } from '../../locataires/kit/links';

export function InvoicingGate({ children }: { children: ReactNode }) {
  const permissions = useInvoicingPermissions();
  if (permissions.available) return children;
  return (
    <>
      <PageHeader crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Factures' }]} title="Factures" />
      <Alert tone="info" title="Facturation indisponible pour ce compte">
        {AGENCY_ONLY_MESSAGE}
      </Alert>
    </>
  );
}
