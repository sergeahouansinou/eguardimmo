'use client';

import { Alert } from '@eguardimmo/ui';
import type { ReactNode } from 'react';
import { biensFeatureLabel } from './capabilities';
import type { BiensFeature } from './capabilities';
import { useBiensSource } from './source';

export function useFeatureUnavailable(feature: BiensFeature): boolean {
  return useBiensSource().unavailableInApiMode.includes(feature);
}

export function FeatureUnavailable({ feature }: { feature: BiensFeature }) {
  return (
    <Alert tone="info" title="Bientôt disponible">
      {`${biensFeatureLabel[feature]} : cette fonction n’est pas encore reliée au serveur. Aucune donnée d’exemple n’est affichée à la place.`}
    </Alert>
  );
}

export function FeatureGate({ feature, children }: { feature: BiensFeature; children: ReactNode }) {
  return useFeatureUnavailable(feature) ? <FeatureUnavailable feature={feature} /> : children;
}

export function WhenAvailable({ feature, children }: { feature: BiensFeature; children: ReactNode }) {
  return useFeatureUnavailable(feature) ? null : children;
}
