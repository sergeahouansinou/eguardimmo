'use client';

import { useState } from 'react';
import { Mail, Pencil, Phone, Trash2 } from 'lucide-react';
import { Alert, Avatar, Badge, Button, Card, CardTitle } from '@eguardimmo/ui';
import type { BadgeTone } from '@eguardimmo/ui';
import { ConfirmDialog, EmptyBlock, PageHeader, pushFlash, QueryState, useSourceMutation } from '../../outils/kit';
import type { ScreenProps } from '../../outils/kit';
import { bienLabel } from '../shared/biens';
import { formatFrDate } from '../shared/dates';
import { openExternal } from '../shared/external';
import { statusLabels } from '../interventions/schemas';
import type { InterventionStatus } from '../interventions/schemas';
import { useInterventions } from '../interventions/source';
import { initialsOf } from './logic';
import { categoryText } from './schemas';
import type { Contact } from './schemas';
import { CONTACTS_KEY, useContacts, useContactsSource } from './source';

const statusTone: Record<InterventionStatus, BadgeTone> = { ouverte: 'neutral', en_cours: 'warning', terminee: 'success' };

export function ContactDetailPage({ Link, navigate, id }: ScreenProps & { id: string }) {
  const query = useContacts();
  return (
    <QueryState query={query} errorTitle="Le contact n’a pas pu être chargé" loadingLabel="Chargement du contact">
      {(items) => {
        const contact = items.find((candidate) => candidate.id === id);
        if (!contact) {
          return (
            <>
              <PageHeader Link={Link} crumbs={[{ label: 'Outils' }, { label: 'Carnet de contacts', href: '/contacts' }, { label: 'Introuvable' }]} title="Contact introuvable" />
              <EmptyBlock
                title="Contact introuvable"
                action={
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/contacts">Retour au carnet</Link>
                  </Button>
                }
              >
                Il a peut-être été supprimé.
              </EmptyBlock>
            </>
          );
        }
        return <ContactDetail Link={Link} navigate={navigate} contact={contact} />;
      }}
    </QueryState>
  );
}

function ContactDetail({ Link, navigate, contact }: Pick<ScreenProps, 'Link' | 'navigate'> & { contact: Contact }) {
  const source = useContactsSource();
  const interventions = useInterventions();
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const remove = useSourceMutation((id: string) => source.remove(id), [CONTACTS_KEY]);
  const linked = (interventions.data ?? []).filter((item) => item.intervenant === contact.name);

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Outils' }, { label: 'Carnet de contacts', href: '/contacts' }, { label: contact.name }]}
        title={contact.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{categoryText(contact)}</span>
            <Badge tone={contact.shared ? 'info' : 'neutral'}>{contact.shared ? 'Partagé' : 'Privé'}</Badge>
            {contact.archived ? <Badge tone="neutral">Archivé</Badge> : null}
          </span>
        }
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href={`/contacts/${contact.id}/modifier`}>
                <Pencil size={16} aria-hidden="true" />
                Modifier
              </Link>
            </Button>
            <Button variant="secondary" onClick={() => { setConfirming(true); }}>
              <Trash2 size={16} aria-hidden="true" />
              Supprimer
            </Button>
          </>
        }
      />
      {failure ? <Alert tone="danger" title="La suppression n’a pas abouti">{failure}</Alert> : null}
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card aria-labelledby="contact-coordonnees">
            <CardTitle as="h2" id="contact-coordonnees">Coordonnées</CardTitle>
            <div className="flex items-center gap-3">
              <Avatar initials={initialsOf(contact.name)} size="md" />
              <span className="flex flex-col">
                <b className="text-body-strong text-fg">{contact.name}</b>
                <span className="text-caption text-fg-subtle">{contact.subtitle === '' ? 'Aucune précision' : contact.subtitle}</span>
              </span>
            </div>
            <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-body">
              <dt className="text-fg-subtle">Téléphone</dt>
              <dd className="flex flex-wrap items-center gap-2">
                {contact.phone === '' ? '—' : contact.phone}
                {contact.phone !== '' ? (
                  <Button variant="link" size="sm" onClick={() => { openExternal(`tel:${contact.phone.replace(/[^+\d]/g, '')}`); }}>
                    <Phone size={14} aria-hidden="true" />
                    Appeler
                  </Button>
                ) : null}
              </dd>
              <dt className="text-fg-subtle">E-mail</dt>
              <dd className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="min-w-0 break-all">{contact.email === '' ? '—' : contact.email}</span>
                {contact.email !== '' ? (
                  <Button variant="link" size="sm" onClick={() => { openExternal(`mailto:${contact.email}`); }}>
                    <Mail size={14} aria-hidden="true" />
                    Écrire
                  </Button>
                ) : null}
              </dd>
              <dt className="text-fg-subtle">Biens</dt>
              <dd>{contact.bienIds.length === 0 ? '—' : contact.bienIds.map(bienLabel).join(' ; ')}</dd>
              <dt className="text-fg-subtle">Partage</dt>
              <dd>{contact.shared ? 'Visible par les locataires du bien' : 'Privé, visible par vous seul'}</dd>
            </dl>
          </Card>
          <Card aria-labelledby="contact-notes">
            <CardTitle as="h2" id="contact-notes">Notes</CardTitle>
            {contact.notes === '' ? (
              <p className="text-body text-fg-subtle">Aucune note. Ajoutez-en depuis « Modifier ».</p>
            ) : (
              <p className="whitespace-pre-line text-body text-fg">{contact.notes}</p>
            )}
          </Card>
        </div>
        <Card aria-labelledby="contact-interventions">
          <CardTitle as="h2" id="contact-interventions">Interventions liées</CardTitle>
          {interventions.isError ? (
            <Alert tone="danger" title="Les interventions n’ont pas pu être chargées">
              <Button variant="link" size="sm" onClick={interventions.refetch}>Réessayer</Button>
            </Alert>
          ) : interventions.data === undefined ? (
            <div role="status" aria-label="Chargement des interventions" className="h-9 animate-pulse rounded-sm bg-muted" />
          ) : linked.length === 0 ? (
            <p className="text-body text-fg-subtle">Aucune intervention confiée à ce contact.</p>
          ) : (
            <ul className="flex flex-col">
              {linked.map((item) => (
                <li key={item.id} className="flex flex-col gap-0.5 border-t border-line py-2 first:border-t-0">
                  <span className="flex items-center justify-between gap-2">
                    <Link href={`/interventions/${item.id}`} className="text-body-strong text-action-on-subtle underline-offset-2 hover:underline">{item.subject}</Link>
                    <Badge tone={statusTone[item.status]}>{statusLabels[item.status]}</Badge>
                  </span>
                  <span className="text-caption text-fg-subtle">{bienLabel(item.bienId)}{item.dueDate ? ` · échéance ${formatFrDate(item.dueDate)}` : ''}</span>
                </li>
              ))}
            </ul>
          )}
          <Button variant="secondary" size="sm" className="self-start" onClick={() => { navigate('/interventions/nouvelle'); }}>
            Créer une intervention
          </Button>
        </Card>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Supprimer ce contact ?"
        description={`« ${contact.name} » sera retiré du carnet définitivement. Pour le conserver, archivez-le plutôt.`}
        confirmLabel="Supprimer"
        pending={remove.isPending}
        onConfirm={() => {
          remove.mutate(contact.id, {
            onSuccess: () => {
              pushFlash(`Contact « ${contact.name} » supprimé.`);
              navigate('/contacts');
            },
            onError: () => {
              setConfirming(false);
              setFailure('Réessayez dans un instant.');
            },
          });
        }}
      />
    </>
  );
}
