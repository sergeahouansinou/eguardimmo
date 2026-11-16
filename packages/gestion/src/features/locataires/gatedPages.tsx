'use client';

import type { ComponentType } from 'react';
import { CandidatDossierPage as Dossier } from './CandidatDossierPage';
import { CandidatInvitePage as Invite } from './CandidatInvitePage';
import { CandidatsPage as Candidates } from './CandidatsPage';
import { FeatureUnavailable, useFeatureUnavailable } from './FeatureGate';
import { PageHeader } from './kit';
import { links } from './kit/links';
import { locatairesPaths } from './paths';

function gated<P extends object>(title: string, Page: ComponentType<P>): ComponentType<P> {
  function Gated(props: P) {
    const unavailable = useFeatureUnavailable('candidates');
    if (!unavailable) return <Page {...props} />;
    return (
      <>
        <PageHeader crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Locataires', href: locatairesPaths.list }, { label: title }]} title={title} />
        <FeatureUnavailable feature="candidates" />
      </>
    );
  }
  Gated.displayName = `Gated(${title})`;
  return Gated;
}

export const CandidatsPage = gated('Candidats', Candidates);
export const CandidatDossierPage = gated('Dossier de candidature', Dossier);
export const CandidatInvitePage = gated('Inviter un candidat', Invite);
