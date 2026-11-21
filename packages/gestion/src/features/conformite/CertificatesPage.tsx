'use client';

import { Button, Card, EmptyState, Icon, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { FileCheck, Plus } from 'lucide-react';
import { useState } from 'react';
import { AddCertificateDialog } from './AddCertificateDialog';
import { CertificateActions } from './CertificateActions';
import { ALL, CertificateFilters, NO_FILTER, isFiltered, isState } from './CertificateFilters';
import type { CertificateFilterState } from './CertificateFilters';
import { useCertificateDownload } from './useCertificateDownload';
import { useCertificateTypes, useCertificates, useConformitePermissions } from './hooks';
import { byUrgency, expiryText, remainingLabel } from './labels';
import type { Certificate } from './model';
import { conformitePaths } from './paths';
import { PriorityAlerts } from './PriorityAlerts';
import { RenewCertificateDialog } from './RenewCertificateDialog';
import { StateBadge } from './StateBadge';
import { useSubjectChoices } from './useSubjects';
import { LinkButton, ListLoading, LoadError, PageHeader, useGestionNavigation } from '../locataires/kit';
import { formatDateFr, todayIso } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { CursorPager, useCursorPages } from '../finances/rent/CursorPager';

export function CertificatesPage() {
  const permissions = useConformitePermissions();
  const pages = useCursorPages();
  const types = useCertificateTypes();
  const download = useCertificateDownload();
  const choices = useSubjectChoices();
  const [filters, setFilters] = useState<CertificateFilterState>(NO_FILTER);
  const [adding, setAdding] = useState(false);
  const [renewing, setRenewing] = useState<Certificate | null>(null);

  const query = {
    cursor: pages.cursor,
    state: isState(filters.state) ? filters.state : undefined,
    typeId: filters.typeId === ALL ? undefined : filters.typeId,
    includeReplaced: filters.includeReplaced ? true : undefined,
  };
  const certificates = useCertificates(query);
  const rows = [...(certificates.data?.items ?? [])].sort(byUrgency);

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Conformité' }]}
        title="Conformité"
        subtitle="Diagnostics, assurances et pièces à échéance, avec leur état de validité."
        actions={
          <>
            <LinkButton href={conformitePaths.documents} icon={FileCheck}>Documents</LinkButton>
            {permissions.write ? <Button onClick={() => { setAdding(true); }}><Icon icon={Plus} />Ajouter une pièce</Button> : null}
          </>
        }
      />
      <PriorityAlerts />
      <Card role="region" aria-label="Pièces de conformité" className="gap-3">
        <CertificateFilters filters={filters} types={types.data ?? []} onChange={(next) => { setFilters(next); pages.reset(); }} />
        {certificates.isError ? <LoadError title={certificates.error?.message ?? 'Les pièces n’ont pas pu être chargées'} /> : null}
        {certificates.isPending && !certificates.isError ? <ListLoading label="Chargement des pièces" /> : null}
        {certificates.data && rows.length === 0 ? (
          <EmptyState
            icon={FileCheck}
            title="Aucune pièce"
            description={isFiltered(filters) ? 'Aucune pièce ne correspond à ces filtres.' : 'Ajoutez un diagnostic, une assurance ou la carte professionnelle pour suivre leurs échéances.'}
          />
        ) : null}
        {rows.length > 0 ? (
          <Table aria-label="Pièces de conformité">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Pièce</TableHeaderCell>
                <TableHeaderCell>Concerne</TableHeaderCell>
                <TableHeaderCell>Émise le</TableHeaderCell>
                <TableHeaderCell>Échéance</TableHeaderCell>
                <TableHeaderCell>État</TableHeaderCell>
                <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((certificate) => (
                <CertificateRow key={certificate.id} certificate={certificate} subjectLabel={choices.labelOf(certificate.subject)} canWrite={permissions.write} onDownload={(entry) => { void download(entry); }} onRenew={setRenewing} />
              ))}
            </TableBody>
          </Table>
        ) : null}
        <CursorPager pages={pages} nextCursor={certificates.data?.nextCursor ?? null} label="Pagination des pièces" />
      </Card>
      {permissions.write ? <AddCertificateDialog open={adding} onClose={() => { setAdding(false); }} /> : null}
      {permissions.write ? <RenewCertificateDialog certificate={renewing} onClose={() => { setRenewing(null); }} /> : null}
    </>
  );
}

function CertificateRow({ certificate, subjectLabel, canWrite, onDownload, onRenew }: { certificate: Certificate; subjectLabel: string; canWrite: boolean; onDownload: (certificate: Certificate) => void; onRenew: (certificate: Certificate) => void }) {
  const { Link } = useGestionNavigation();
  return (
    <TableRow>
      <TableCell strong>
        <Link href={conformitePaths.certificate(certificate.id)} className="flex flex-col text-action-on-subtle underline-offset-2 hover:underline">
          <span>{certificate.type.label}</span>
          {certificate.reference ? <span className="text-caption font-normal text-fg-subtle">{certificate.reference}</span> : null}
        </Link>
      </TableCell>
      <TableCell>{subjectLabel}</TableCell>
      <TableCell>{formatDateFr(certificate.issuedOn)}</TableCell>
      <TableCell>
        <span className="flex flex-col">
          <span>{expiryText(certificate.expiresOn)}</span>
          {certificate.expiresOn ? <span className="text-caption text-fg-subtle">{remainingLabel(certificate, todayIso())}</span> : null}
        </span>
      </TableCell>
      <TableCell>
        <span className="flex flex-wrap items-center gap-1">
          <StateBadge state={certificate.state} />
          {certificate.replacedById !== null ? <span className="text-caption text-fg-subtle">Remplacée</span> : null}
        </span>
      </TableCell>
      <TableCell><CertificateActions certificate={certificate} canWrite={canWrite} onDownload={onDownload} onRenew={onRenew} /></TableCell>
    </TableRow>
  );
}
