'use client';

import { Award, Ban, BellRing, Download, Eye, PenLine } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  DialogClose,
  DialogContent,
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
import type { BadgeTone } from '@eguardimmo/ui';
import { useState } from 'react';
import { useLeaseLookups } from '../baux/BauxParts';
import { useCancelSignature, useRemindSignature, useSignatures } from './hooks';
import { courriersPaths } from './paths';
import type { Signature, SignatureStatus } from './schemas';
import { ActionMenu, ItemRow, LinkButton, ListLoading, LoadError, PageHeader, SearchInput, errorMessage, useNotify } from '../locataires/kit';
import type { ActionItem } from '../locataires/kit';
import { formatDateFr } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { useListView } from '../locataires/kit/useListView';
import type { ListTab } from '../locataires/kit/useListView';

const statusBadge: Record<SignatureStatus, { label: string; tone: BadgeTone }> = {
  en_cours: { label: 'En attente', tone: 'warning' },
  signe: { label: 'Signé', tone: 'success' },
  refuse: { label: 'Refusé', tone: 'danger' },
  annule: { label: 'Annulé', tone: 'neutral' },
};

const ALL = 'tous';

const tabs: ListTab<Signature>[] = [
  { id: 'tous', label: 'Toutes', match: () => true },
  { id: 'en_cours', label: 'En attente', match: (item) => item.status === 'en_cours' },
  { id: 'signes', label: 'Signées', match: (item) => item.status === 'signe' },
  { id: 'refuses', label: 'Refusées', match: (item) => item.status === 'refuse' },
  { id: 'annules', label: 'Annulées', match: (item) => item.status === 'annule' },
];

const signedCount = (item: Signature) => item.signers.filter((signer) => signer.status === 'signe').length;

function stateLabel(item: Signature): string {
  return item.status === 'en_cours' ? `En attente, ${String(signedCount(item))}/${String(item.signers.length)}` : statusBadge[item.status].label;
}

export function SignaturesPage() {
  const signatures = useSignatures();
  const cancel = useCancelSignature();
  const remind = useRemindSignature();
  const notify = useNotify();
  const [detail, setDetail] = useState<Signature | null>(null);
  const [pendingCancel, setPendingCancel] = useState<Signature | null>(null);
  const [unitId, setUnitId] = useState(ALL);
  const [year, setYear] = useState(ALL);
  const lookups = useLeaseLookups();

  const items = signatures.data ?? [];
  const unitIds = [...new Set(items.flatMap((item) => (item.unitId ? [item.unitId] : [])))].sort((a, b) => lookups.unitLabel(a).localeCompare(lookups.unitLabel(b), 'fr'));
  const years = [...new Set(items.map((item) => item.createdOn.slice(0, 4)))].sort().reverse();
  const view = useListView({
    items,
    tabs,
    searchText: (item) => `${item.title} ${item.reference} ${item.signers.map((signer) => signer.name).join(' ')}`,
    predicate: (item) => (unitId === ALL || item.unitId === unitId) && (year === ALL || item.createdOn.startsWith(year)),
  });

  const confirmCancel = async () => {
    const target = pendingCancel;
    setPendingCancel(null);
    if (!target) return;
    try {
      await cancel.mutateAsync(target.id);
      notify({ title: 'Demande annulée', description: target.title });
    } catch (error) {
      notify({ tone: 'danger', title: 'Annulation impossible', description: errorMessage(error) });
    }
  };

  const remindSigners = async (target: Signature) => {
    try {
      await remind.mutateAsync(target.id);
      notify({ title: 'Signataires relancés', description: `${target.title}, ${String(target.signers.filter((signer) => signer.status !== 'signe').length)} rappel(s) envoyé(s)` });
    } catch (error) {
      notify({ tone: 'danger', title: 'Relance impossible', description: errorMessage(error) });
    }
  };

  const download = (target: Signature, kind: 'documents' | 'certificat') => {
    const text = kind === 'documents' ? `Document : ${target.title}\nFichier : ${target.fileName}\n` : `Certificat de signature ${target.reference}\n${target.signers.map((signer) => `${signer.name} <${signer.email}> : ${signer.status === 'signe' ? 'a signé' : signer.status === 'refuse' ? 'a refusé' : 'en attente'}`).join('\n')}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${target.reference}-${kind}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    notify({ title: kind === 'documents' ? 'Documents téléchargés' : 'Certificat téléchargé', description: target.reference });
  };

  const actionsFor = (item: Signature): ActionItem[] => [
    { id: 'detail', label: 'Voir les signataires', icon: Eye, onSelect: () => { setDetail(item); } },
    { id: 'remind', label: 'Relancer les signataires', icon: BellRing, disabled: item.status !== 'en_cours', onSelect: () => { void remindSigners(item); } },
    { id: 'documents', label: 'Télécharger les documents', icon: Download, separatorBefore: true, onSelect: () => { download(item, 'documents'); } },
    { id: 'certificate', label: 'Télécharger le certificat', icon: Award, disabled: item.status !== 'signe', onSelect: () => { download(item, 'certificat'); } },
    { id: 'cancel', label: 'Annuler la demande', icon: Ban, tone: 'danger', separatorBefore: true, disabled: item.status !== 'en_cours', onSelect: () => { setPendingCancel(item); } },
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Documents', href: courriersPaths.documents }, { label: 'Signatures' }]}
        title="Signatures électroniques"
        subtitle="Un document, ses signataires et l’état de chaque signature."
        actions={<LinkButton href={courriersPaths.newSignature} variant="primary" icon={PenLine}>Nouvelle signature</LinkButton>}
      />
      {signatures.isError ? <LoadError title="Les signatures n’ont pas pu être chargées" /> : null}
      <Card role="region" aria-label="Liste des signatures" className="gap-3">
        <Tabs value={view.tab} onValueChange={view.setTab} defaultValue="tous">
          <TabList aria-label="Filtrer les signatures">
            {tabs.map((tab) => (
              <Tab key={tab.id} value={tab.id} count={view.counts[tab.id] ?? 0}>{tab.label}</Tab>
            ))}
          </TabList>
          <TabPanel value={view.tab} className="flex flex-col gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput label="Rechercher une demande" placeholder="Document, signataire" value={view.query} onValueChange={view.setQuery} />
              <Select
                label="Bien"
                hideLabel
                placeholder="Bien : Tous"
                value={unitId}
                onValueChange={(value) => { setUnitId(value); view.resetPage(); }}
                options={[{ value: ALL, label: 'Bien : Tous' }, ...unitIds.map((entry) => ({ value: entry, label: lookups.unitLabel(entry) }))]}
                className="w-56"
              />
              <Select
                label="Période"
                hideLabel
                placeholder="Période : Toutes"
                value={year}
                onValueChange={(value) => { setYear(value); view.resetPage(); }}
                options={[{ value: ALL, label: 'Période : Toutes' }, ...years.map((entry) => ({ value: entry, label: `Période : ${entry}` }))]}
                className="w-48"
              />
            </div>
            {signatures.isPending ? <ListLoading label="Chargement des signatures" /> : null}
            {signatures.data && view.rows.length === 0 ? (
              <EmptyState icon={PenLine} title="Aucune demande" description={view.query === '' && unitId === ALL && year === ALL ? 'Rien à afficher dans cette rubrique pour le moment.' : 'Aucune demande ne correspond à cette recherche.'}>
                <LinkButton href={courriersPaths.newSignature} variant="primary">Nouvelle signature</LinkButton>
              </EmptyState>
            ) : null}
            {view.rows.length > 0 ? (
              <Table aria-label="Demandes de signature">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Description</TableHeaderCell>
                    <TableHeaderCell>Signataires</TableHeaderCell>
                    <TableHeaderCell>Date</TableHeaderCell>
                    <TableHeaderCell>État</TableHeaderCell>
                    <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {view.rows.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell strong>
                        {item.title}
                        <span className="block text-caption font-normal text-fg-subtle">{`${item.reference}, ${item.fileName}`}</span>
                        {item.reminderSentOn ? <span className="block text-caption font-normal text-fg-subtle">{`Relancé le ${formatDateFr(item.reminderSentOn)}`}</span> : null}
                      </TableCell>
                      <TableCell>{item.signers.map((signer) => signer.name).join(', ')}</TableCell>
                      <TableCell>{formatDateFr(item.createdOn)}</TableCell>
                      <TableCell><Badge tone={statusBadge[item.status].tone}>{stateLabel(item)}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {item.status === 'en_cours' ? (
                            <Button variant="secondary" size="sm" aria-label={`Relancer, ${item.reference}`} onClick={() => { void remindSigners(item); }}>Relancer</Button>
                          ) : (
                            <Button variant="secondary" size="sm" aria-label={`Ouvrir, ${item.reference}`} onClick={() => { setDetail(item); }}>Ouvrir</Button>
                          )}
                          <ActionMenu label={`Plus d’actions, ${item.reference}`} items={actionsFor(item)} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
            <Pagination page={view.page} pageSize={view.pageSize} total={view.total} onPageChange={view.setPage} label="Pagination des signatures" />
          </TabPanel>
        </Tabs>
      </Card>

      <Dialog open={detail !== null} onOpenChange={(open) => { if (!open) setDetail(null); }}>
        <DialogContent title={detail?.title ?? 'Signataires'} description={detail ? `${detail.reference}, ${detail.fileName}` : undefined}>
          <div className="flex flex-col gap-3 p-4">
            <ul>
              {detail?.signers.map((signer) => (
                <ItemRow
                  key={signer.email}
                  icon={PenLine}
                  title={signer.name}
                  detail={signer.email}
                  badge={signer.status === 'signe' ? { label: 'A signé', tone: 'success' } : signer.status === 'refuse' ? { label: 'A refusé', tone: 'danger' } : { label: 'En attente', tone: 'warning' }}
                />
              ))}
            </ul>
            <div className="flex justify-end">
              <DialogClose asChild>
                <Button variant="secondary">Fermer</Button>
              </DialogClose>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={pendingCancel !== null}
        onOpenChange={(open) => { if (!open) setPendingCancel(null); }}
        title="Annuler cette demande de signature ?"
        description={`Les signataires de « ${pendingCancel?.title ?? ''} » ne pourront plus signer le document.`}
        confirmLabel="Annuler la demande"
        tone="danger"
        onConfirm={() => { void confirmCancel(); }}
      />
    </>
  );
}
