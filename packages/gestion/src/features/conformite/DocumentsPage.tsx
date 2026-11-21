'use client';

import { Alert, Card, EmptyState, IconButton, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { BadgeCheck, Download, FileText } from 'lucide-react';
import { useCertificates, useConformitePermissions } from './hooks';
import type { Certificate } from './model';
import { conformitePaths } from './paths';
import { StateBadge } from './StateBadge';
import { useCertificateDownload } from './useCertificateDownload';
import { useSubjectChoices } from './useSubjects';
import { LinkButton, ListLoading, LoadError, PageHeader, useGestionNavigation } from '../locataires/kit';
import { formatDateFr } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { CursorPager, useCursorPages } from '../finances/rent/CursorPager';

const PAGE_SIZE = 100;

export function DocumentsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const permissions = useConformitePermissions();
  const pages = useCursorPages();
  const choices = useSubjectChoices();
  const download = useCertificateDownload();
  const certificates = useCertificates({ cursor: pages.cursor, perPage: PAGE_SIZE, includeReplaced: true });
  const rows = (certificates.data?.items ?? []).filter((certificate) => certificate.storedFileId !== null);
  return (
    <>
      {embedded ? null : (
        <>
          <PageHeader
            crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Documents' }]}
            title="Documents"
            subtitle="Justificatifs joints aux pièces de conformité."
            actions={<LinkButton href={conformitePaths.certificates} icon={BadgeCheck}>Conformité</LinkButton>}
          />
          <Alert tone="info" title="Seuls les justificatifs de conformité sont disponibles pour l’instant">
            Le dépôt de documents libres, le classement par bien, le partage avec les locataires et l’archivage seront proposés avec leurs écrans. Pour ajouter un justificatif, ajoutez ou renouvelez une pièce de conformité.
          </Alert>
        </>
      )}
      <Card role="region" aria-label={embedded ? 'Justificatifs joints aux pièces de conformité' : 'Documents'} className="gap-3">
        {certificates.isError ? <LoadError title={certificates.error?.message ?? 'Les documents n’ont pas pu être chargés'} /> : null}
        {certificates.isPending && !certificates.isError ? <ListLoading label="Chargement des documents" /> : null}
        {certificates.data && rows.length === 0 ? (
          <EmptyState icon={FileText} title={embedded ? 'Aucun justificatif de conformité' : 'Aucun document'} description="Les justificatifs apparaissent ici dès qu’ils sont joints à une pièce de conformité.">
            {permissions.write ? <LinkButton href={conformitePaths.certificates} variant="primary">Ajouter une pièce</LinkButton> : null}
          </EmptyState>
        ) : null}
        {rows.length > 0 ? (
          <Table aria-label="Justificatifs de conformité">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Document</TableHeaderCell>
                <TableHeaderCell>Concerne</TableHeaderCell>
                <TableHeaderCell>Émis le</TableHeaderCell>
                <TableHeaderCell>État de la pièce</TableHeaderCell>
                <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((certificate) => (
                <DocumentRow key={certificate.id} certificate={certificate} subjectLabel={choices.labelOf(certificate.subject)} onDownload={(entry) => { void download(entry); }} />
              ))}
            </TableBody>
          </Table>
        ) : null}
        <CursorPager pages={pages} nextCursor={certificates.data?.nextCursor ?? null} label="Pagination des documents" />
      </Card>
    </>
  );
}

function DocumentRow({ certificate, subjectLabel, onDownload }: { certificate: Certificate; subjectLabel: string; onDownload: (certificate: Certificate) => void }) {
  const { Link } = useGestionNavigation();
  const name = `${certificate.type.label}${certificate.reference ? ` ${certificate.reference}` : ''}`;
  return (
    <TableRow>
      <TableCell strong>
        <Link href={conformitePaths.certificate(certificate.id)} className="text-action-on-subtle underline-offset-2 hover:underline">{name}</Link>
      </TableCell>
      <TableCell>{subjectLabel}</TableCell>
      <TableCell>{formatDateFr(certificate.issuedOn)}</TableCell>
      <TableCell><StateBadge state={certificate.state} /></TableCell>
      <TableCell><IconButton label={`Télécharger le justificatif, ${name}`} icon={Download} onClick={() => { onDownload(certificate); }} /></TableCell>
    </TableRow>
  );
}
