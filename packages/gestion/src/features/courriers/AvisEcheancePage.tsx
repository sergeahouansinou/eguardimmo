'use client';

import { Eye, Mail } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Pagination,
  Select,
  Tab,
  TabList,
  TabPanel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Tabs,
} from '@eguardimmo/ui';
import { useState } from 'react';
import { useLeaseLookups } from '../baux/BauxParts';
import { useNotices, useSendNotice } from './hooks';
import { courriersPaths } from './paths';
import type { Notice } from './schemas';
import { ActionMenu, ListLoading, LoadError, PageHeader, SearchInput, errorMessage, useGestionNavigation, useNotify } from '../locataires/kit';
import type { ActionItem } from '../locataires/kit';
import { formatDateFr, monthLabel } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { money } from '../locataires/kit/money';
import { useListView } from '../locataires/kit/useListView';
import type { ListTab } from '../locataires/kit/useListView';

const ALL = 'tous';

const tabs: ListTab<Notice>[] = [
  { id: 'a_envoyer', label: 'À envoyer', match: (item) => item.sentOn === null },
  { id: 'envoyes', label: 'Envoyés', match: (item) => item.sentOn !== null },
];

export const noticeTotal = (notice: Pick<Notice, 'rent' | 'charges' | 'arrears'>): number => notice.rent + notice.charges + notice.arrears;

export function AvisEcheancePage() {
  const notices = useNotices();
  const lookups = useLeaseLookups();
  const { push, Link } = useGestionNavigation();
  const notify = useNotify();
  const send = useSendNotice();
  const [month, setMonth] = useState(ALL);
  const [confirming, setConfirming] = useState(false);

  const items = notices.data ?? [];
  const months = [...new Set(items.map((item) => item.month))].sort().reverse();
  const searchText = (item: Notice) => `${lookups.tenantName(item.tenantId)} ${lookups.unitLabel(item.unitId)}`;
  const view = useListView({ items, tabs, searchText, predicate: (item) => month === ALL || item.month === month });
  const toSend = items.filter((item) => item.sentOn === null && (month === ALL || item.month === month));

  const sendOne = async (item: Notice) => {
    try {
      await send.mutateAsync(item.id);
      notify({ title: 'Avis envoyé', description: `${lookups.tenantName(item.tenantId)}, ${monthLabel(item.month)}` });
    } catch (error) {
      notify({ tone: 'danger', title: 'Envoi impossible', description: errorMessage(error) });
    }
  };

  const sendAll = async () => {
    setConfirming(false);
    try {
      for (const item of toSend) await send.mutateAsync(item.id);
      notify({ title: 'Avis envoyés', description: `${String(toSend.length)} avis d’échéance envoyés.` });
    } catch (error) {
      notify({ tone: 'danger', title: 'Envoi interrompu', description: errorMessage(error) });
    }
  };

  const actionsFor = (item: Notice): ActionItem[] => [
    { id: 'preview', label: 'Aperçu', icon: Eye, onSelect: () => { push(courriersPaths.notice(item.id)); } },
    { id: 'send', label: 'Envoyer à ce locataire', icon: Mail, disabled: item.sentOn !== null, onSelect: () => { void sendOne(item); } },
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Documents', href: courriersPaths.documents }, { label: 'Avis d’échéance' }]}
        title="Avis d’échéance"
        subtitle={notices.data ? `${String(view.counts.a_envoyer ?? 0)} avis à envoyer.` : ' '}
        actions={<Button disabled={toSend.length === 0} loading={send.isPending} onClick={() => { setConfirming(true); }}>Envoyer les avis</Button>}
      />
      {notices.isError ? <LoadError title="Les avis d’échéance n’ont pas pu être chargés" /> : null}
      <Card role="region" aria-label="Liste des avis d’échéance" className="gap-3">
        <Tabs value={view.tab} onValueChange={view.setTab} defaultValue="a_envoyer">
          <TabList aria-label="Filtrer les avis d’échéance">
            {tabs.map((tab) => (
              <Tab key={tab.id} value={tab.id} count={view.counts[tab.id] ?? 0}>{tab.label}</Tab>
            ))}
          </TabList>
          <TabPanel value={view.tab} className="flex flex-col gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput label="Rechercher un avis" placeholder="Locataire ou bien" value={view.query} onValueChange={view.setQuery} />
              <Select
                label="Mois"
                hideLabel
                placeholder="Mois : Tous"
                value={month}
                onValueChange={(value) => { setMonth(value); view.resetPage(); }}
                options={[{ value: ALL, label: 'Mois : Tous' }, ...months.map((entry) => ({ value: entry, label: monthLabel(entry) }))]}
                className="w-52"
              />
            </div>
            {notices.isPending ? <ListLoading label="Chargement des avis d’échéance" /> : null}
            {notices.data && view.rows.length === 0 ? (
              <EmptyState icon={Mail} title="Aucun avis" description={view.query !== '' || month !== ALL ? 'Aucun avis ne correspond à ces filtres.' : 'Rien à afficher dans cette rubrique pour le moment.'} />
            ) : null}
            {view.rows.length > 0 ? (
              <Table aria-label="Avis d’échéance">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Locataire</TableHeaderCell>
                    <TableHeaderCell>Bien</TableHeaderCell>
                    <TableHeaderCell>Échéance</TableHeaderCell>
                    <TableHeaderCell numeric>Montant</TableHeaderCell>
                    <TableHeaderCell>Statut</TableHeaderCell>
                    <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {view.rows.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell strong>
                        <Link href={courriersPaths.notice(item.id)} className="text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">{lookups.tenantName(item.tenantId)}</Link>
                      </TableCell>
                      <TableCell>{lookups.unitShort(item.unitId)}</TableCell>
                      <TableCell>{`${monthLabel(item.month)}, ${formatDateFr(item.due)}`}</TableCell>
                      <TableCell numeric>{money(noticeTotal(item))}</TableCell>
                      <TableCell><Badge tone={item.sentOn ? 'success' : 'warning'}>{item.sentOn ? `Envoyé le ${formatDateFr(item.sentOn)}` : 'À envoyer'}</Badge></TableCell>
                      <TableCell><ActionMenu label={`Plus d’actions, avis de ${lookups.tenantName(item.tenantId)}, ${monthLabel(item.month)}`} items={actionsFor(item)} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
            <Pagination page={view.page} pageSize={view.pageSize} total={view.total} onPageChange={view.setPage} label="Pagination des avis d’échéance" />
          </TabPanel>
        </Tabs>
      </Card>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Envoyer les avis d’échéance ?"
        description={`${String(toSend.length)} avis seront envoyés par e-mail aux locataires concernés.`}
        confirmLabel="Envoyer les avis"
        onConfirm={() => { void sendAll(); }}
      />
    </>
  );
}
