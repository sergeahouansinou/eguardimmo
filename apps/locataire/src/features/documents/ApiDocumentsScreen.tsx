'use client';

import { Card, EmptyState, Tab, TabList, TabPanel, Tabs } from '@eguardimmo/ui';
import { FolderOpen } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { DataTable } from '@/components/DataTable';
import { DownloadButton } from '@/components/DownloadButton';
import { FailureAlert } from '@/components/FailureAlert';
import { DOCUMENT_WORDING } from '@/tenant/documentLabels';
import { LeaseGate } from '@/components/LeaseGate';
import { PageHeader } from '@/components/PageHeader';
import { Skeleton } from '@/components/ScreenState';
import { formatDate } from '@/lib/dates';
import { formatFileSize } from '@/lib/money';
import { useFileDownload, useLeaseDocuments } from '@/tenant/documentQueries';
import { DOCUMENT_GROUPS, GROUP_LABEL, inspectionRow, leaseDocumentRow, receiptRow, sortByDate, submissionRow } from '@/tenant/documentRows';
import type { DocumentRow } from '@/tenant/documentRows';
import { useInspections } from '@/tenant/inspectionQueries';
import { useInsurance } from '@/tenant/insuranceQueries';
import { useReceipts } from '@/tenant/rentQueries';
import { useSelectedLease } from '@/tenant/selectedLease';
import { LoadMore } from '../rent/LoadMore';

const FILTERS = ['tous', ...DOCUMENT_GROUPS] as const;
type Filter = (typeof FILTERS)[number];

export function ApiDocumentsScreen() {
  const selection = useSelectedLease();
  return (
    <>
      <PageHeader
        title="Documents"
        crumbs={[{ label: 'Mon logement' }, { label: 'Documents' }]}
        subtitle="Les documents de votre bail : pièces partagées par votre agence, quittances, états des lieux et attestations d’assurance."
      />
      <LeaseGate selection={selection} errorTitle="Vos baux n’ont pas pu être chargés">
        {(lease) => <LeaseDocuments key={lease.id} leaseId={lease.id} />}
      </LeaseGate>
    </>
  );
}

function LeaseDocuments({ leaseId }: { leaseId: string }) {
  const documents = useLeaseDocuments(leaseId);
  const receipts = useReceipts(leaseId);
  const inspections = useInspections();
  const insurance = useInsurance(leaseId);
  const download = useFileDownload();
  const [filter, setFilter] = useState<Filter>('tous');

  const rows = sortByDate([
    ...(documents.data?.pages.flatMap((page) => page.items) ?? []).map((item) => leaseDocumentRow(leaseId, item)),
    ...(receipts.data?.pages.flatMap((page) => page.items) ?? []).map(receiptRow),
    ...(inspections.data?.pages.flatMap((page) => page.items) ?? []).filter((item) => item.leaseId === leaseId && item.publishedAt !== null).map(inspectionRow),
    ...(insurance.data?.submissions ?? []).map(submissionRow),
  ]);
  const sources = [
    { title: 'Les pièces du bail n’ont pas pu être chargées', query: documents },
    { title: 'Les quittances n’ont pas pu être chargées', query: receipts },
    { title: 'Les états des lieux n’ont pas pu être chargés', query: inspections },
    { title: 'Les attestations d’assurance n’ont pas pu être chargées', query: insurance },
  ];
  const loading = sources.every((source) => source.query.isPending);
  const count = (value: Filter) => (value === 'tous' ? rows.length : rows.filter((row) => row.group === value).length);
  const visible = filter === 'tous' ? rows : rows.filter((row) => row.group === filter);
  const paged = [documents, receipts, inspections];

  return (
    <>
      {sources.map((source) =>
        source.query.isError ? (
          <FailureAlert key={source.title} title={source.title} error={source.query.error} wording={DOCUMENT_WORDING} onRetry={() => void source.query.refetch()} />
        ) : null,
      )}
      {download.isError ? <FailureAlert title="Le téléchargement a échoué" error={download.error} wording={DOCUMENT_WORDING} /> : null}
      {loading ? (
        <Skeleton rows={3} />
      ) : (
        <Card role="region" aria-label="Liste des documents" className="px-4 py-3">
          <Tabs value={filter} defaultValue="tous" onValueChange={(value) => { setFilter(FILTERS.find((entry) => entry === value) ?? 'tous'); }}>
            <TabList aria-label="Catégories de documents">
              <Tab value="tous" count={count('tous')}>Tous</Tab>
              {DOCUMENT_GROUPS.map((group) => (
                <Tab key={group} value={group} count={count(group)}>
                  {GROUP_LABEL[group]}
                </Tab>
              ))}
            </TabList>
            <TabPanel value={filter} className="flex flex-col gap-3 pt-2">
              {visible.length === 0 ? (
                <EmptyState icon={FolderOpen} title="Aucun document" description="Aucun document n’est disponible dans cette catégorie pour ce bail." />
              ) : (
                <DataTable
                  label="Documents"
                  rows={visible}
                  rowKey={(row) => row.key}
                  columns={[
                    { id: 'document', header: 'Document', primary: true, cell: (row) => <DocumentName row={row} /> },
                    { id: 'categorie', header: 'Catégorie', cell: (row) => GROUP_LABEL[row.group] },
                    { id: 'date', header: 'Date', cell: (row) => (row.date === null ? '—' : formatDate(row.date)) },
                    { id: 'taille', header: 'Taille', numeric: true, cell: (row) => (row.sizeBytes === null ? '—' : formatFileSize(row.sizeBytes)) },
                    {
                      id: 'action',
                      header: 'Action',
                      numeric: true,
                      mobileLabel: '',
                      cell: (row) =>
                        row.file === null ? null : (
                          <DownloadButton
                            label={`Télécharger ${row.name}`}
                            pending={download.isPending}
                            onDownload={() => { if (row.file) download.mutate(row.file); }}
                          />
                        ),
                    },
                  ]}
                />
              )}
            </TabPanel>
          </Tabs>
        </Card>
      )}
      <LoadMore
        query={{
          hasNextPage: paged.some((query) => query.hasNextPage),
          isFetchNextPageError: paged.some((query) => query.isFetchNextPageError),
          isFetchingNextPage: paged.some((query) => query.isFetchingNextPage),
          error: paged.find((query) => query.isFetchNextPageError)?.error,
          fetchNextPage: () => Promise.all(paged.filter((query) => query.hasNextPage).map((query) => query.fetchNextPage())),
        }}
        label="Afficher plus de documents"
        errorTitle="Les documents suivants n’ont pas pu être chargés"
      />
    </>
  );
}

function DocumentName({ row }: { row: DocumentRow }) {
  return (
    <>
      {row.href === null ? row.name : <Link href={row.href} className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">{row.name}</Link>}
      <br />
      <span className="text-caption font-normal text-fg-subtle">{row.detail}</span>
    </>
  );
}
