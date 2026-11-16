'use client';

import { Alert } from '@eguardimmo/ui';
import type { ReactNode } from 'react';
import { bauxFeatureLabel } from './capabilities';
import type { BauxFeature } from './capabilities';
import { useBauxSource } from './source';

export function useFeatureUnavailable(feature: BauxFeature): boolean {
  return useBauxSource().unavailableInApiMode.includes(feature);
}

export function FeatureUnavailable({ feature }: { feature: BauxFeature }) {
  return (
    <Alert tone="info" title="Bientôt disponible">
      {`${bauxFeatureLabel[feature]} : cette fonction n’est pas encore reliée au serveur. Aucune donnée d’exemple n’est affichée à la place.`}
    </Alert>
  );
}

export function FeatureGate({ feature, children }: { feature: BauxFeature; children: ReactNode }) {
  return useFeatureUnavailable(feature) ? <FeatureUnavailable feature={feature} /> : children;
}
