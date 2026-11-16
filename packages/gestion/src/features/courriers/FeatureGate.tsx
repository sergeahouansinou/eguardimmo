'use client';

import { Alert } from '@eguardimmo/ui';
import { useCourriersSource } from './source';

export const useCourriersUnavailable = (): boolean => useCourriersSource().unavailableInApiMode;

export function CourriersUnavailable() {
  return (
    <Alert tone="info" title="Bientôt disponible">
      Les courriers, quittances, avis d’échéance, attestations et signatures ne sont pas encore reliés au serveur. Aucune donnée d’exemple n’est affichée à la place.
    </Alert>
  );
}
