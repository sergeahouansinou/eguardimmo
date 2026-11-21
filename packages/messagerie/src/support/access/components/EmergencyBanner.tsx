'use client';

import { Alert } from '@eguardimmo/ui';
import { basisLabel } from '../copy';
import type { AccessGrant } from '../model';
import { formatDateTime } from '../../../lib/dates';

export function EmergencyBanner({ emergencies }: { emergencies: readonly AccessGrant[] }) {
  if (emergencies.length === 0) return null;
  return (
    <Alert tone="danger" title="Accès d’urgence du support en cours">
      <ul className="flex flex-col gap-1">
        {emergencies.map((grant) => (
          <li key={grant.id}>
            {grant.operator} consulte vos réglages et votre équipe en lecture seule
            {grant.expiresAt ? ` jusqu’au ${formatDateTime(grant.expiresAt)}` : ''}
            {grant.emergencyBasis ? ` (${basisLabel[grant.emergencyBasis].toLowerCase()})` : ''}. Vous pouvez le révoquer ci-dessous.
          </li>
        ))}
      </ul>
    </Alert>
  );
}
