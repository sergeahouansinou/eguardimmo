'use client';

import { Alert } from '@eguardimmo/ui';
import type { ReactNode } from 'react';
import { locatairesFeatureLabel } from './capabilities';
import type { LocatairesFeature } from './capabilities';
import { useLocatairesSource } from './source';

export function useFeatureUnavailable(feature: LocatairesFeature): boolean {
  return useLocatairesSource().unavailableInApiMode.includes(feature);
}

export function FeatureUnavailable({ feature }: { feature: LocatairesFeature }) {
  return (
    <Alert tone="info" title="Bientôt disponible">
      {`${locatairesFeatureLabel[feature]} : cette fonction n’est pas encore reliée au serveur. Aucune donnée d’exemple n’est affichée à la place.`}
    </Alert>
  );
}

export function FeatureGate({ feature, children }: { feature: LocatairesFeature; children: ReactNode }) {
  return useFeatureUnavailable(feature) ? <FeatureUnavailable feature={feature} /> : children;
}
