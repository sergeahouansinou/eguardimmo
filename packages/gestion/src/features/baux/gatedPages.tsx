'use client';

import type { ComponentType } from 'react';
import { BailEcheancierPage as Schedule } from './BailEcheancierPage';
import { EtatLieuxComparePage as EdlCompare } from './EtatLieuxComparePage';
import { EtatLieuxFormPage as EdlForm } from './EtatLieuxFormPage';
import { EtatLieuxPage as Edl } from './EtatLieuxPage';
import { EtatsLieuxPage as Edls } from './EtatsLieuxPage';
import { FeatureUnavailable, useFeatureUnavailable } from './FeatureGate';
import { ReservationContratPage as ReservationContract } from './ReservationContratPage';
import { ReservationFormPage as ReservationForm } from './ReservationFormPage';
import { ReservationsPage as Reservations } from './ReservationsPage';
import type { BauxFeature } from './capabilities';
import { bauxPaths } from './paths';
import { PageHeader } from '../locataires/kit';
import { links } from '../locataires/kit/links';

function gated<P extends object>(feature: BauxFeature, title: string, Page: ComponentType<P>): ComponentType<P> {
  function Gated(props: P) {
    const unavailable = useFeatureUnavailable(feature);
    if (!unavailable) return <Page {...props} />;
    return (
      <>
        <PageHeader crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Baux', href: bauxPaths.list }, { label: title }]} title={title} />
        <FeatureUnavailable feature={feature} />
      </>
    );
  }
  Gated.displayName = `Gated(${title})`;
  return Gated;
}

export const BailEcheancierPage = gated('schedule', 'Échéancier', Schedule);
export const EtatsLieuxPage = gated('edl', 'États des lieux', Edls);
export const EtatLieuxPage = gated('edl', 'État des lieux', Edl);
export const EtatLieuxFormPage = gated('edl', 'État des lieux', EdlForm);
export const EtatLieuxComparePage = gated('edl', 'Comparaison des états des lieux', EdlCompare);
export const ReservationsPage = gated('reservations', 'Réservations', Reservations);
export const ReservationFormPage = gated('reservations', 'Réservation', ReservationForm);
export const ReservationContratPage = gated('reservations', 'Contrat de réservation', ReservationContract);
