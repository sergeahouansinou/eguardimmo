'use client';

import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Icon } from '@eguardimmo/ui';
import { Download, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { ConformiteApiError } from './api/conformiteErrors';
import { canRenew } from './CertificateActions';
import { useCertificate, useConformitePermissions } from './hooks';
import { expiryText, fieldLabel, remainingLabel } from './labels';
import type { Certificate } from './model';
import { conformitePaths } from './paths';
import { RenewCertificateDialog } from './RenewCertificateDialog';
import { StateBadge } from './StateBadge';
import { useCertificateDownload } from './useCertificateDownload';
import { useSubjectChoices } from './useSubjects';
import { DescriptionList, ListLoading, LoadError, NotFoundPanel, PageHeader, useGestionNavigation } from '../locataires/kit';
import { formatDateFr, todayIso } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';

const CRUMBS = [{ label: 'Accueil', href: links.home }, { label: 'Conformité', href: conformitePaths.certificates }];

export function CertificateDetailPage({ id }: { id: string }) {
  const certificate = useCertificate(id);
  if (certificate.isError) {
    if (certificate.error instanceof ConformiteApiError && certificate.error.kind === 'not_found') {
      return (
        <>
          <PageHeader crumbs={[...CRUMBS, { label: 'Introuvable' }]} title="Pièce introuvable" />
          <NotFoundPanel title="Cette pièce n’existe pas" description="Elle a peut-être été supprimée ou le lien est incorrect." backHref={conformitePaths.certificates} backLabel="Retour à la conformité" />
        </>
      );
    }
    return (
      <>
        <PageHeader crumbs={[...CRUMBS, { label: 'Pièce' }]} title="Pièce" />
        <LoadError title={certificate.error?.message ?? 'La pièce n’a pas pu être chargée'} />
      </>
    );
  }
  if (!certificate.data) {
    return (
      <>
        <PageHeader crumbs={[...CRUMBS, { label: 'Pièce' }]} title="Pièce" />
        <ListLoading label="Chargement de la pièce" />
      </>
    );
  }
  return <Detail certificate={certificate.data} />;
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  return '—';
}

function Detail({ certificate }: { certificate: Certificate }) {
  const { Link } = useGestionNavigation();
  const permissions = useConformitePermissions();
  const choices = useSubjectChoices();
  const download = useCertificateDownload();
  const [renewing, setRenewing] = useState(false);
  const values = Object.entries(certificate.values);
  const title = certificate.reference ? `${certificate.type.label}, ${certificate.reference}` : certificate.type.label;
  return (
    <>
      <PageHeader
        crumbs={[...CRUMBS, { label: certificate.type.label }]}
        title={title}
        badges={<StateBadge state={certificate.state} />}
        actions={
          <>
            {certificate.storedFileId !== null ? <Button variant="secondary" onClick={() => { void download(certificate); }}><Icon icon={Download} />Télécharger le justificatif</Button> : null}
            {permissions.write && canRenew(certificate) ? <Button onClick={() => { setRenewing(true); }}><Icon icon={RefreshCw} />Renouveler</Button> : null}
          </>
        }
      />
      {certificate.replacedById !== null ? (
        <Alert tone="info" title="Pièce renouvelée">
          Cette pièce a été remplacée par une pièce plus récente.{' '}
          <Link href={conformitePaths.certificate(certificate.replacedById)} className="underline underline-offset-2">Voir la pièce à jour</Link>
        </Alert>
      ) : null}
      {certificate.replacedById === null && certificate.state !== 'valid' ? (
        <Alert tone={certificate.state === 'expired' ? 'danger' : 'warning'} title={certificate.state === 'expired' ? 'Pièce expirée' : 'Pièce à renouveler'}>
          {certificate.state === 'expired' ? 'Cette pièce n’est plus valable : renouvelez-la avec un nouveau justificatif.' : `Son échéance approche (${remainingLabel(certificate, todayIso()).toLowerCase()}).`}
        </Alert>
      ) : null}
      <Card className="gap-3">
        <CardHeader><CardTitle as="h2">Informations</CardTitle></CardHeader>
        <CardContent>
          <DescriptionList
            termWidth="110px"
            items={[
              { term: 'Type', detail: certificate.type.label },
              { term: 'Concerne', detail: choices.labelOf(certificate.subject) },
              { term: 'Référence', detail: certificate.reference ?? '—' },
              { term: 'Émise le', detail: formatDateFr(certificate.issuedOn) },
              { term: 'Échéance', detail: expiryText(certificate.expiresOn) },
              ...values.map(([key, value]) => ({ term: fieldLabel(key), detail: formatValue(value) })),
              { term: 'Justificatif', detail: certificate.storedFileId !== null ? 'Fichier joint' : 'Aucun fichier joint' },
            ]}
          />
        </CardContent>
      </Card>
      {certificate.replacesId !== null ? (
        <Card className="gap-3">
          <CardHeader><CardTitle as="h2">Historique</CardTitle></CardHeader>
          <CardContent>
            <Link href={conformitePaths.certificate(certificate.replacesId)} className="text-action-on-subtle underline-offset-2 hover:underline">Voir la pièce remplacée</Link>
          </CardContent>
        </Card>
      ) : null}
      {permissions.write ? <RenewCertificateDialog certificate={renewing ? certificate : null} onClose={() => { setRenewing(false); }} /> : null}
    </>
  );
}
