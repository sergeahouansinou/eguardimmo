'use client';

import type { ComponentType } from 'react';
import { AttestationApercuPage as Attestation } from './AttestationApercuPage';
import { AvisEcheanceApercuPage as NoticePreview } from './AvisEcheanceApercuPage';
import { AvisEcheancePage as Notices } from './AvisEcheancePage';
import { CourrierApercuPage as LetterPreview } from './CourrierApercuPage';
import { CourrierFormPage as LetterForm } from './CourrierFormPage';
import { CourriersPage as Letters } from './CourriersPage';
import { CourriersUnavailable, useCourriersUnavailable } from './FeatureGate';
import { ModeleApercuPage as TemplatePreview } from './ModeleApercuPage';
import { ModeleFormPage as TemplateForm } from './ModeleFormPage';
import { ModelesPage as Templates } from './ModelesPage';
import { QuittanceApercuPage as ReceiptPreview } from './QuittanceApercuPage';
import { QuittancesPage as Receipts } from './QuittancesPage';
import { SignatureNewPage as SignatureForm } from './SignatureNewPage';
import { SignaturesPage as Signatures } from './SignaturesPage';
import { PageHeader } from '../locataires/kit';
import { links } from '../locataires/kit/links';

function gated<P extends object>(title: string, Page: ComponentType<P>): ComponentType<P> {
  function Gated(props: P) {
    const unavailable = useCourriersUnavailable();
    if (!unavailable) return <Page {...props} />;
    return (
      <>
        <PageHeader crumbs={[{ label: 'Accueil', href: links.home }, { label: title }]} title={title} />
        <CourriersUnavailable />
      </>
    );
  }
  Gated.displayName = `Gated(${title})`;
  return Gated;
}

export const AttestationApercuPage = gated('Attestation de restitution', Attestation);
export const AvisEcheanceApercuPage = gated('Avis d’échéance', NoticePreview);
export const AvisEcheancePage = gated('Avis d’échéance', Notices);
export const CourrierApercuPage = gated('Courrier', LetterPreview);
export const CourrierFormPage = gated('Courrier', LetterForm);
export const CourriersPage = gated('Courriers', Letters);
export const ModeleApercuPage = gated('Modèle', TemplatePreview);
export const ModeleFormPage = gated('Modèle', TemplateForm);
export const ModelesPage = gated('Modèles', Templates);
export const QuittanceApercuPage = gated('Quittance', ReceiptPreview);
export const QuittancesPage = gated('Quittances', Receipts);
export const SignatureNewPage = gated('Demande de signature', SignatureForm);
export const SignaturesPage = gated('Signatures', Signatures);
