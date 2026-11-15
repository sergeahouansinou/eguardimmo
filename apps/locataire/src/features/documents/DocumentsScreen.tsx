'use client';

import { Button, Card, Select, Tab, TabList, TabPanel, Tabs, TextField } from '@eguardimmo/ui';
import Link from 'next/link';
import { useState } from 'react';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { Pagination } from '@/components/Pagination';
import { Async } from '@/components/ScreenState';
import { useDocuments } from '@/data/queries';
import type { DemoDocument } from '@/data/schemas/logement';
import { formatDate } from '@/lib/dates';
import { downloadDemoPdf } from '@eguardimmo/shell';
import { formatFileSize } from '@/lib/money';

const PAGE_SIZE = 10;
const TABS: readonly { value: 'tous' | DemoDocument['group']; label: string }[] = [
  { value: 'tous', label: 'Tous' },
  { value: 'contrat', label: 'Contrat' },
  { value: 'quittances', label: 'Quittances' },
  { value: 'autres', label: 'Autres' },
];

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function DocumentsScreen() {
  const documents = useDocuments();
  return (
    <>
      <PageHeader
        title="Documents"
        crumbs={[{ label: 'Mon logement' }, { label: 'Documents' }]}
        subtitle="Les documents de votre bail, classés et disponibles à tout moment."
      />
      <Async query={documents} errorTitle="Les documents n’ont pas pu être chargés">
        {(items) => <DocumentsList items={items} />}
      </Async>
    </>
  );
}

function DocumentsList({ items }: { items: DemoDocument[] }) {
  const [tab, setTab] = useState<string>('tous');
  const [search, setSearch] = useState('');
  const [year, setYear] = useState('toutes');
  const [page, setPage] = useState(1);
  const years = Array.from(new Set(items.map((item) => item.issuedOn.slice(0, 4)))).sort().reverse();
  const needle = fold(search.trim());
  const rows = items.filter(
    (item) =>
      (tab === 'tous' || item.group === tab) &&
      (year === 'toutes' || item.issuedOn.startsWith(year)) &&
      (needle === '' || fold(`${item.name} ${item.category}`).includes(needle)),
  );
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const count = (value: string) => (value === 'tous' ? items.length : items.filter((item) => item.group === value).length);

  return (
    <Card role="region" aria-label="Liste des documents" className="px-4 py-3">
      <Tabs value={tab} defaultValue="tous" onValueChange={(value) => { setTab(value); setPage(1); }}>
        <TabList aria-label="Catégories de documents">
          {TABS.map((entry) => (
            <Tab key={entry.value} value={entry.value} count={count(entry.value)}>
              {entry.label}
            </Tab>
          ))}
        </TabList>
        <TabPanel value={tab} className="flex flex-col gap-3 pt-2">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-80">
              <TextField
                label="Rechercher un document"
                type="search"
                placeholder="Rechercher, par exemple assurance"
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              />
            </div>
            <Select
              label="Année"
              placeholder="Année"
              className="w-44"
              value={year}
              options={[{ value: 'toutes', label: 'Année : toutes' }, ...years.map((value) => ({ value, label: value }))]}
              onValueChange={(value) => { setYear(value); setPage(1); }}
            />
          </div>
          {rows.length === 0 ? (
            <p className="py-6 text-center text-body text-fg-subtle">Aucun document ne correspond à votre recherche.</p>
          ) : (
            <DataTable
              label="Documents"
              rows={visible}
              rowKey={(doc) => doc.id}
              columns={[
                {
                  id: 'document',
                  header: 'Document',
                  primary: true,
                  cell: (doc) =>
                    doc.href ? (
                      <Link href={doc.href} className="hover:underline">
                        {doc.name}
                      </Link>
                    ) : (
                      doc.name
                    ),
                },
                { id: 'categorie', header: 'Catégorie', cell: (doc) => doc.category },
                { id: 'date', header: 'Date', cell: (doc) => formatDate(doc.issuedOn) },
                { id: 'taille', header: 'Taille', numeric: true, cell: (doc) => formatFileSize(doc.sizeBytes) },
                {
                  id: 'action',
                  header: 'Action',
                  numeric: true,
                  mobileLabel: '',
                  cell: (doc) => (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Télécharger ${doc.name}`}
                      onClick={() => { downloadDemoPdf(`${doc.id}.pdf`, doc.name, [doc.detail]); }}
                    >
                      Télécharger
                    </Button>
                  ),
                },
              ]}
            />
          )}
          <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} />
        </TabPanel>
      </Tabs>
    </Card>
  );
}
