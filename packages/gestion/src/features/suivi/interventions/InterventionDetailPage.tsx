'use client';

import { useState } from 'react';
import { Archive, ArchiveRestore, Bell, Pencil, Receipt, Trash2, UserPlus } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, CardTitle, Select } from '@eguardimmo/ui';
import type { BadgeTone } from '@eguardimmo/ui';
import { ConfirmDialog, EmptyBlock, PageHeader, pushFlash, QueryState, useSourceMutation } from '../../outils/kit';
import type { ScreenProps } from '../../outils/kit';
import { money } from '../../locataires/kit/money';
import { useContacts } from '../contacts/source';
import { bienLabel, tenantOf } from '../shared/biens';
import { formatFrDate } from '../shared/dates';
import { InterventionDialogHost } from './InterventionDialogHost';
import type { DialogState } from './InterventionDialogHost';
import { expenseHref, isLate } from './logic';
import { priorityLabels, quoteStatusLabels, statusLabels, STATUSES } from './schemas';
import type { Intervention, InterventionStatus, Priority, QuoteStatus } from './schemas';
import { INTERVENTIONS_KEY, useInterventions, useInterventionsSource } from './source';

const priorityTone: Record<Priority, BadgeTone> = { urgente: 'danger', normale: 'warning', basse: 'info' };
const statusTone: Record<InterventionStatus, BadgeTone> = { ouverte: 'neutral', en_cours: 'warning', terminee: 'success' };
const quoteTone: Record<QuoteStatus, BadgeTone> = { a_valider: 'warning', accepte: 'success', refuse: 'danger' };

export function InterventionDetailPage({ Link, navigate, id }: ScreenProps & { id: string }) {
  const query = useInterventions();
  return (
    <QueryState query={query} errorTitle="L’intervention n’a pas pu être chargée" loadingLabel="Chargement de l’intervention">
      {(items) => {
        const item = items.find((candidate) => candidate.id === id);
        if (!item) {
          return (
            <>
              <PageHeader Link={Link} crumbs={[{ label: 'Interventions', href: '/interventions' }, { label: 'Introuvable' }]} title="Intervention introuvable" />
              <EmptyBlock
                title="Intervention introuvable"
                action={
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/interventions">Retour aux interventions</Link>
                  </Button>
                }
              >
                Elle a peut-être été supprimée.
              </EmptyBlock>
            </>
          );
        }
        return <InterventionDetail Link={Link} navigate={navigate} item={item} />;
      }}
    </QueryState>
  );
}

function InterventionDetail({ Link, navigate, item }: Pick<ScreenProps, 'Link' | 'navigate'> & { item: Intervention }) {
  const source = useInterventionsSource();
  const contacts = useContacts();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const invalidate = [INTERVENTIONS_KEY] as const;
  const setStatus = useSourceMutation((status: InterventionStatus) => source.setStatus(item.id, status), invalidate);
  const setArchived = useSourceMutation((archived: boolean) => source.setArchived(item.id, archived), invalidate);
  const decide = useSourceMutation((status: 'accepte' | 'refuse') => source.decideQuote(item.id, status), invalidate);
  const remove = useSourceMutation(() => source.remove(item.id), invalidate);
  const fail = () => { setFailure('L’action n’a pas abouti. Réessayez dans un instant.'); };

  const tenant = tenantOf(item.bienId);
  const contact = item.intervenant ? contacts.data?.find((candidate) => candidate.name === item.intervenant) : undefined;
  const history = [...item.history].reverse();

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Interventions', href: '/interventions' }, { label: item.subject }]}
        title={item.subject}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{bienLabel(item.bienId)}</span>
            <Badge tone={priorityTone[item.priority]}>{priorityLabels[item.priority]}</Badge>
            <Badge tone={statusTone[item.status]}>{statusLabels[item.status]}</Badge>
            {isLate(item) ? <Badge tone="danger">En retard</Badge> : null}
            {item.archived ? <Badge tone="neutral">Archivée</Badge> : null}
          </span>
        }
        actions={
          <Button variant="secondary" asChild>
            <Link href={`/interventions/${item.id}/modifier`}>
              <Pencil size={16} aria-hidden="true" />
              Modifier
            </Link>
          </Button>
        }
      />
      {failure ? <Alert tone="danger" title="L’action n’a pas abouti">{failure}</Alert> : null}
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card aria-labelledby="intervention-infos">
            <CardTitle as="h2" id="intervention-infos">Informations</CardTitle>
            <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-body">
              <dt className="text-fg-subtle">Bien</dt>
              <dd>{bienLabel(item.bienId)}</dd>
              <dt className="text-fg-subtle">Locataire</dt>
              <dd>{tenant ?? 'Aucun locataire en place'}</dd>
              <dt className="text-fg-subtle">Échéance</dt>
              <dd>{item.dueDate ? formatFrDate(item.dueDate) : '—'}</dd>
              <dt className="text-fg-subtle">Mise à jour</dt>
              <dd>{formatFrDate(item.updatedAt)}</dd>
              <dt className="text-fg-subtle">Locataire prévenu</dt>
              <dd>{item.notifyTenant ? 'Oui, à la planification' : 'Non'}</dd>
              <dt className="text-fg-subtle">Description</dt>
              <dd className="whitespace-pre-line">{item.description === '' ? '—' : item.description}</dd>
              <dt className="text-fg-subtle">Photos</dt>
              <dd>{item.photos.length === 0 ? 'Aucune photo' : item.photos.map((photo) => photo.name).join(' ; ')}</dd>
            </dl>
          </Card>
          <Card aria-labelledby="intervention-devis">
            <CardHeader>
              <CardTitle as="h2" id="intervention-devis">Devis</CardTitle>
              <Button variant="link" size="sm" onClick={() => { setDialog({ kind: 'quote', item }); }}>
                {item.quote ? 'Modifier le devis' : 'Enregistrer un devis'}
              </Button>
            </CardHeader>
            {item.quote ? (
              <div className="flex flex-col gap-2">
                <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-body">
                  <dt className="text-fg-subtle">Montant TTC</dt>
                  <dd className="font-semibold text-fg">{money(item.quote.amount)}</dd>
                  <dt className="text-fg-subtle">Reçu le</dt>
                  <dd>{formatFrDate(item.quote.receivedOn)}</dd>
                  <dt className="text-fg-subtle">État</dt>
                  <dd><Badge tone={quoteTone[item.quote.status]}>{quoteStatusLabels[item.quote.status]}</Badge></dd>
                </dl>
                {item.quote.status === 'a_valider' ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      loading={decide.isPending && decide.variables === 'accepte'}
                      onClick={() => {
                        decide.mutate('accepte', { onSuccess: () => { pushFlash('Devis accepté.'); }, onError: fail });
                      }}
                    >
                      Accepter le devis
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={decide.isPending && decide.variables === 'refuse'}
                      onClick={() => {
                        decide.mutate('refuse', { onSuccess: () => { pushFlash('Devis refusé.'); }, onError: fail });
                      }}
                    >
                      Refuser le devis
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-body text-fg-subtle">Aucun devis reçu pour cette intervention.</p>
            )}
          </Card>
          <Card aria-labelledby="intervention-historique">
            <CardTitle as="h2" id="intervention-historique">Historique</CardTitle>
            {history.length === 0 ? (
              <p className="text-body text-fg-subtle">Aucun événement enregistré.</p>
            ) : (
              <ol aria-label="Historique de l’intervention" className="flex flex-col">
                {history.map((entry) => (
                  <li key={entry.id} className="flex flex-col gap-0.5 border-t border-line py-2 first:border-t-0">
                    <span className="flex items-center justify-between gap-2">
                      <b className="text-body-strong text-fg">{entry.label}</b>
                      <span className="text-caption text-fg-subtle">{formatFrDate(entry.date)}</span>
                    </span>
                    {entry.detail === '' ? null : <span className="whitespace-pre-line text-caption text-fg-muted">{entry.detail}</span>}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <Card aria-labelledby="intervention-etat">
            <CardTitle as="h2" id="intervention-etat">État</CardTitle>
            <Select
              label="Changer l’état"
              placeholder="Choisir un état"
              options={STATUSES.map((value) => ({ value, label: statusLabels[value] }))}
              value={item.status}
              disabled={setStatus.isPending}
              onValueChange={(value) => {
                const status = STATUSES.find((candidate) => candidate === value);
                if (!status || status === item.status) return;
                setStatus.mutate(status, { onSuccess: () => { pushFlash(`Intervention « ${item.subject} » : ${statusLabels[status].toLowerCase()}.`); }, onError: fail });
              }}
            />
          </Card>
          <Card aria-labelledby="intervention-intervenant">
            <CardTitle as="h2" id="intervention-intervenant">Intervenant</CardTitle>
            {item.intervenant ? (
              contact ? (
                <Link href={`/contacts/${contact.id}`} className="text-body-strong text-action-on-subtle underline-offset-2 hover:underline">{item.intervenant}</Link>
              ) : (
                <b className="text-body-strong text-fg">{item.intervenant}</b>
              )
            ) : (
              <p className="text-body text-fg-subtle">Aucun intervenant assigné.</p>
            )}
            <Button variant="secondary" size="sm" className="self-start" onClick={() => { setDialog({ kind: 'assign', item }); }}>
              <UserPlus size={14} aria-hidden="true" />
              {item.intervenant ? 'Changer d’intervenant' : 'Assigner un intervenant'}
            </Button>
          </Card>
          <Card aria-labelledby="intervention-actions">
            <CardTitle as="h2" id="intervention-actions">Actions</CardTitle>
            <div className="flex flex-col items-start gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => { setDialog({ kind: 'notify', item }); }}>
                <Bell size={14} aria-hidden="true" />
                Prévenir le locataire
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { navigate(expenseHref(item)); }}>
                <Receipt size={14} aria-hidden="true" />
                Ajouter une dépense
              </Button>
              <Button
                variant="ghost"
                size="sm"
                loading={setArchived.isPending}
                onClick={() => {
                  const archived = !item.archived;
                  setArchived.mutate(archived, {
                    onSuccess: () => { pushFlash(archived ? `Intervention « ${item.subject} » archivée.` : `Intervention « ${item.subject} » remise parmi les actives.`); },
                    onError: fail,
                  });
                }}
              >
                {item.archived ? <ArchiveRestore size={14} aria-hidden="true" /> : <Archive size={14} aria-hidden="true" />}
                {item.archived ? 'Désarchiver' : 'Archiver'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setDeleting(true); }}>
                <Trash2 size={14} aria-hidden="true" />
                Supprimer
              </Button>
            </div>
          </Card>
        </div>
      </div>
      <InterventionDialogHost state={dialog} onClose={() => { setDialog(null); }} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Supprimer cette intervention ?"
        description={`« ${item.subject} » sera supprimée définitivement.`}
        confirmLabel="Supprimer"
        pending={remove.isPending}
        onConfirm={() => {
          remove.mutate(undefined, {
            onSuccess: () => {
              pushFlash(`Intervention « ${item.subject} » supprimée.`);
              navigate('/interventions');
            },
            onError: () => {
              setDeleting(false);
              fail();
            },
          });
        }}
      />
    </>
  );
}
