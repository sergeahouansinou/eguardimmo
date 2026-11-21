'use client';

import { Alert } from '@eguardimmo/ui';
import type { ReactNode } from 'react';
import { useOrgInfoSource } from '../orgapi/source';

export function InvestmentsGate({ children }: { children: ReactNode }) {
  const { kind } = useOrgInfoSource();
  if (kind === 'agency') {
    return (
      <Alert tone="info" title="Réservé aux bailleurs autonomes">
        Les prêts et le coût de revient ne sont pas ouverts à une agence : ils concernent le patrimoine d’un particulier.
      </Alert>
    );
  }
  return children;
}
