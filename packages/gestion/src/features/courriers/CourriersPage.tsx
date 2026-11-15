'use client';

import { Copy, FileText, Mail, PenLine, SquarePen, Trash2 } from 'lucide-react';
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
import type { BadgeTone } from '@eguardimmo/ui';
import { useState } from 'react';
import { useLeaseLookups } from '../baux/BauxParts';
import { useCourriers, useDeleteCourrier, useMarkCourrierSent, useTemplates } from './hooks';
import { courriersPaths } from './paths';
import { channelLabel } from './schemas';
import type { Courrier, CourrierStatus } from './schemas';
import { ActionMenu, LinkButton, ListLoading, LoadError, PageHeader, SearchInput, errorMessage, useGestionNavigation, useNotify } from '../locataires/kit';
import type { ActionItem } from '../locataires/kit';
import { addDays, formatDateFr, todayIso } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { useListView } from '../locataires/kit/useListView';
import type { ListTab } from '../locataires/kit/useListView';

const ALL = 'tous';
const LAST_30_DAYS = '30j';

const statusBadge: Record<CourrierStatus, { label: string; tone: BadgeTone }> = {
  brouillon: { label: 'Brouillon', tone: 'neutral' },
  genere: { label: 'Généré', tone: 'info' },
  envoye: { label: 'Envoyé', tone: 'success' },
};

const tabs: ListTab<Courrier>[] = [
  { id: 'tous', label: 'Tous', match: () => true },
  { id: 'brouillons', label: 'Brouillons', match: (item) => item.status === 'brouillon' },
  { id: 'a_envoyer', label: 'À envoyer', match: (item) => item.status === 'genere' },
  { id: 'envoyes', label: 'Envoyés', match: (item) => item.status === 'envoye' },
];

export function CourriersPage() {
  const courriers = useCourriers();
  const templates = useTemplates();
  const lookups = useLeaseLookups();
  const { push, Link } = useGestionNavigation();
  const notify = useNotify();
  const send = useMarkCourrierSent();
  const remove = useDeleteCourrier();
  const [templateId, setTemplateId] = useState(ALL);
  const [period, setPeriod] = useState(ALL);
  const [pendingDelete, setPendingDelete] = useState<Courrier | null>(null);

  const items = courriers.data ?? [];
  const searchText = (item: Courrier) => `${item.reference} ${item.subject} ${lookups.tenantName(item.tenantId)}`;
  const view = useListView({ items, tabs, searchText, predicate: (item) => (templateId === ALL || item.templateId === templateId) && (period === ALL || (item.sentOn ?? item.createdOn) >= addDays(todayIso(), -30)) });

  const run = async (task: () => Promise<unknown>, success: { title: string; description?: string }) => {
    try {
      await task();
      notify(success);
    } catch (error) {
      notify({ tone: 'danger', title: 'Action impossible', description: errorMessage(error) });
    }
  };

  const actionsFor = (item: Courrier): ActionItem[] => [
    { id: 'open', label: 'Aperçu du PDF', icon: FileText, onSelect: () => { push(courriersPaths.courrier(item.id)); } },
    { id: 'edit', label: 'Modifier', icon: SquarePen, disabled: item.status === 'envoye', onSelect: () => { push(courriersPaths.editCourrier(item.id)); } },
    {
      id: 'send',
      label: 'Marquer comme envoyé',
      icon: Mail,
      disabled: item.status === 'envoye',
      onSelect: () => { void run(() => send.mutateAsync(item.id), { title: 'Courrier envoyé', description: `${item.reference}, ${lookups.tenantName(item.tenantId)}` }); },
    },
    { id: 'sign', label: 'Envoyer en signature', icon: PenLine, onSelect: () => { push(courriersPaths.signatureFor(item.subject, `${item.reference}.pdf`)); } },
    {
      id: 'reuse',
      label: 'Dupliquer',
      icon: Copy,
      onSelect: () => { push(links.newCourrier({ modele: item.templateId ?? undefined, locataire: item.tenantId, bien: item.unitId ?? undefined })); },
    },
    { id: 'delete', label: 'Supprimer', icon: Trash2, tone: 'danger', separatorBefore: true, disabled: item.status === 'envoye', onSelect: () => { setPendingDelete(item); } },
  ];

  const confirmDelete = async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (target) await run(() => remove.mutateAsync(target.id), { title: 'Courrier supprimé', description: target.reference });
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Documents', href: courriersPaths.documents }, { label: 'Courriers' }]}
        title="Courriers"
        subtitle="Lettres envoyées aux locataires : relances, avis, congés, notifications."
        actions={
          <>
            <LinkButton href={courriersPaths.modeles}>Modèles</LinkButton>
            <LinkButton href={courriersPaths.newCourrier} variant="primary">Nouveau courrier</LinkButton>
          </>
        }
      />
      {courriers.isError ? <LoadError title="Les courriers n’ont pas pu être chargés" /> : null}
      <Card role="region" aria-label="Liste des courriers" className="gap-3">
        <Tabs value={view.tab} onValueChange={view.setTab} defaultValue="tous">
          <TabList aria-label="Filtrer les courriers">
            {tabs.map((tab) => (
              <Tab key={tab.id} value={tab.id} count={view.counts[tab.id] ?? 0}>{tab.label}</Tab>
            ))}
          </TabList>
          <TabPanel value={view.tab} className="flex flex-col gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput label="Rechercher un courrier" placeholder="Sujet, destinataire" value={view.query} onValueChange={view.setQuery} />
              <Select
                label="Modèle"
                hideLabel
                placeholder="Modèle : Tous"
                value={templateId}
                onValueChange={(value) => { setTemplateId(value); view.resetPage(); }}
                options={[{ value: ALL, label: 'Modèle : Tous' }, ...(templates.data ?? []).map((template) => ({ value: template.id, label: template.name }))]}
                className="w-60"
              />
              <Select
                label="Période"
                hideLabel
                placeholder="Période : Toutes"
                value={period}
                onValueChange={(value) => { setPeriod(value); view.resetPage(); }}
                options={[{ value: ALL, label: 'Période : Toutes' }, { value: LAST_30_DAYS, label: 'Période : 30 derniers jours' }]}
                className="w-64"
              />
            </div>
            {courriers.isPending ? <ListLoading label="Chargement des courriers" /> : null}
            {courriers.data && view.rows.length === 0 ? (
              <EmptyState icon={Mail} title="Aucun courrier" description={view.query !== '' || templateId !== ALL || period !== ALL ? 'Aucun courrier ne correspond à ces filtres.' : 'Rien à afficher dans cette rubrique pour le moment.'}>
                <LinkButton href={courriersPaths.newCourrier} variant="primary">Nouveau courrier</LinkButton>
              </EmptyState>
            ) : null}
            {view.rows.length > 0 ? (
              <Table aria-label="Courriers">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Sujet</TableHeaderCell>
                    <TableHeaderCell>À</TableHeaderCell>
                    <TableHeaderCell>Canal</TableHeaderCell>
                    <TableHeaderCell>Date</TableHeaderCell>
                    <TableHeaderCell>Créé le</TableHeaderCell>
                    <TableHeaderCell>État</TableHeaderCell>
                    <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {view.rows.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell strong>
                        <Link href={courriersPaths.courrier(item.id)} className="text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">{item.subject}</Link>
                        <span className="block text-caption font-normal text-fg-subtle">{item.reference}</span>
                      </TableCell>
                      <TableCell>{lookups.tenantName(item.tenantId)}</TableCell>
                      <TableCell>{channelLabel[item.channel]}</TableCell>
                      <TableCell>{item.sentOn ? formatDateFr(item.sentOn) : '—'}</TableCell>
                      <TableCell>{formatDateFr(item.createdOn)}</TableCell>
                      <TableCell><Badge tone={statusBadge[item.status].tone}>{statusBadge[item.status].label}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="secondary" size="sm" aria-label={`Ouvrir, ${item.reference}`} onClick={() => { push(courriersPaths.courrier(item.id)); }}>Ouvrir</Button>
                          <ActionMenu label={`Plus d’actions, ${item.reference}`} items={actionsFor(item)} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
            <Pagination page={view.page} pageSize={view.pageSize} total={view.total} onPageChange={view.setPage} label="Pagination des courriers" />
          </TabPanel>
        </Tabs>
      </Card>
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
        title="Supprimer ce courrier ?"
        description="Le courrier sera supprimé définitivement. Un courrier envoyé ne peut pas être supprimé."
        confirmLabel="Supprimer"
        tone="danger"
        onConfirm={() => { void confirmDelete(); }}
      />
    </>
  );
}
