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
  annule: { label: 'Annulé', tone: 'neutral' },
};

const tabs: ListTab<Signature>[] = [
  { id: 'en_cours', label: 'En attente', match: (item) => item.status === 'en_cours' },
  { id: 'signes', label: 'Signés', match: (item) => item.status === 'signe' },
  { id: 'annules', label: 'Annulés', match: (item) => item.status === 'annule' },
  { id: 'tous', label: 'Tous', match: () => true },
];

export function SignaturesPage() {
  const signatures = useSignatures();
  const cancel = useCancelSignature();
  const remind = useRemindSignature();
  const notify = useNotify();
  const [detail, setDetail] = useState<Signature | null>(null);
  const [pendingCancel, setPendingCancel] = useState<Signature | null>(null);

  const items = signatures.data ?? [];
  const view = useListView({ items, tabs, searchText: (item) => `${item.title} ${item.reference} ${item.signers.map((signer) => signer.name).join(' ')}` });

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
    const text = kind === 'documents' ? `Document : ${target.title}\nFichier : ${target.fileName}\n` : `Certificat de signature ${target.reference}\n${target.signers.map((signer) => `${signer.name} <${signer.email}> : ${signer.status === 'signe' ? 'a signé' : 'en attente'}`).join('\n')}\n`;
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
        title="Signatures"
        subtitle={signatures.data ? `${String(view.counts.en_cours ?? 0)} demandes en attente de signature.` : ' '}
        actions={<LinkButton href={courriersPaths.newSignature} variant="primary" icon={PenLine}>Nouvelle demande</LinkButton>}
      />
      {signatures.isError ? <LoadError title="Les signatures n’ont pas pu être chargées" /> : null}
      <Card role="region" aria-label="Liste des signatures" className="gap-3">
        <Tabs value={view.tab} onValueChange={view.setTab} defaultValue="en_cours">
          <TabList aria-label="Filtrer les signatures">
            {tabs.map((tab) => (
              <Tab key={tab.id} value={tab.id} count={view.counts[tab.id] ?? 0}>{tab.label}</Tab>
            ))}
          </TabList>
          <TabPanel value={view.tab} className="flex flex-col gap-3 pt-1">
            <SearchInput label="Rechercher une demande" placeholder="Titre, référence, signataire" value={view.query} onValueChange={view.setQuery} />
            {signatures.isPending ? <ListLoading label="Chargement des signatures" /> : null}
            {signatures.data && view.rows.length === 0 ? (
              <EmptyState icon={PenLine} title="Aucune demande" description={view.query === '' ? 'Rien à afficher dans cette rubrique pour le moment.' : 'Aucune demande ne correspond à cette recherche.'}>
                <LinkButton href={courriersPaths.newSignature} variant="primary">Nouvelle demande</LinkButton>
              </EmptyState>
            ) : null}
            {view.rows.length > 0 ? (
              <Table aria-label="Demandes de signature">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Document</TableHeaderCell>
                    <TableHeaderCell>Signataires</TableHeaderCell>
                    <TableHeaderCell>Envoyé le</TableHeaderCell>
                    <TableHeaderCell>Statut</TableHeaderCell>
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
                      <TableCell>{`${String(item.signers.filter((signer) => signer.status === 'signe').length)} sur ${String(item.signers.length)} ont signé`}</TableCell>
                      <TableCell>{formatDateFr(item.createdOn)}</TableCell>
                      <TableCell><Badge tone={statusBadge[item.status].tone}>{statusBadge[item.status].label}</Badge></TableCell>
                      <TableCell><ActionMenu label={`Plus d’actions, ${item.reference}`} items={actionsFor(item)} /></TableCell>
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
                  badge={signer.status === 'signe' ? { label: 'A signé', tone: 'success' } : { label: 'En attente', tone: 'warning' }}
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
