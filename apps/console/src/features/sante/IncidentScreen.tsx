'use client';

import { Badge, Button, Dialog, DialogContent, Icon, TextField, Textarea } from '@eguardimmo/ui';
import { BookOpen, CircleCheck, Megaphone, StickyNote } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { errorMessage } from '@/console/hooks/core';
import { useAddIncidentNote, usePublishIncidentUpdate, useResolveIncident } from '@/console/hooks/mutations';
import { useIncident } from '@/console/hooks/queries';
import { incidentNoteInputSchema, incidentUpdateInputSchema } from '@/console/schemas';
import type { IncidentDetail } from '@/console/schemas';
import { formatDate, formatDateTime, formatDurationMinutes, formatTime } from '@/lib/format';
import { useZodForm } from '@/lib/useZodForm';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { FormDialog } from '@/ui/FormDialog';
import { PageHeader } from '@/ui/PageHeader';
import { QueryState } from '@/ui/QueryState';
import { EmptyLine, KeyValueList, ListRow, Section } from '@/ui/Section';
import { Timeline } from '@/ui/Timeline';
import { useNotify } from '@/ui/notify';

export function IncidentScreen({ id }: { id: string }) {
  const query = useIncident(id);
  return (
    <QueryState
      query={query}
      label="L’incident"
      notFound={{
        title: 'Incident introuvable',
        description: 'Cet incident n’existe pas ou n’est plus visible.',
        backHref: '/sante',
        backLabel: 'Retour à la santé du système',
      }}
    >
      {(detail) => <DetailContent detail={detail} />}
    </QueryState>
  );
}

type OpenDialog = 'note' | 'update' | 'resolve' | 'runbook' | null;

function DetailContent({ detail }: { detail: IncidentDetail }) {
  const { incident } = detail;
  const notify = useNotify();
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const addNote = useAddIncidentNote(incident.id);
  const publish = usePublishIncidentUpdate(incident.id);
  const resolve = useResolveIncident(incident.id);
  const close = (open: boolean) => { if (!open) setDialog(null); };
  const open = incident.state === 'en_cours';
  const days = detail.timeline[0] ? formatDate(detail.timeline[0].at) : formatDate(incident.openedAt);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        breadcrumb={[{ label: 'Santé du système', href: '/sante' }, { label: incident.code }]}
        title={incident.title}
        badges={
          <>
            <Badge tone={open ? 'warning' : 'success'}>{open ? 'En cours' : 'Résolu'}</Badge>
            <Badge tone="neutral">{`Sévérité ${String(incident.severity)}`}</Badge>
          </>
        }
        subtitle={`${incident.code} · ouvert à ${formatTime(incident.openedAt)} · durée ${formatDurationMinutes(detail.durationMinutes)} · responsable : ${incident.owner}`}
        actions={
          open ? (
            <>
              <Button variant="secondary" onClick={() => { setDialog('note'); }}>
                <Icon icon={StickyNote} />
                Ajouter une note
              </Button>
              <Button variant="secondary" onClick={() => { setDialog('update'); }}>
                <Icon icon={Megaphone} />
                Publier une mise à jour
              </Button>
              <Button onClick={() => { setDialog('resolve'); }}>
                <Icon icon={CircleCheck} />
                Résoudre l’incident
              </Button>
            </>
          ) : undefined
        }
      />
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {detail.metrics.map((metric) => (
          <div key={metric.label} className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-line bg-surface px-4 py-3">
            <dt className="text-caption text-fg-subtle">{metric.label}</dt>
            <dd className="text-[18px] leading-7 font-semibold break-words">{metric.value}</dd>
            <dd className="text-caption break-words text-fg-subtle">{metric.caption}</dd>
          </div>
        ))}
      </dl>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Section id="chronologie" title="Chronologie" aside={<span className="text-caption text-fg-subtle">{days}</span>}>
          <Timeline
            entries={[...detail.timeline]
              .sort((left, right) => Date.parse(left.at) - Date.parse(right.at))
              .map((entry) => ({
                id: entry.id,
                time: formatTime(entry.at),
                title: entry.title,
                detail: entry.detail,
                tone: entry.tone === 'danger' ? 'danger' : entry.tone === 'warning' ? 'warning' : entry.tone === 'success' ? 'success' : 'default',
              }))}
          />
        </Section>
        <div className="flex flex-col gap-4">
          <Section
            id="communication"
            title="Communication"
            aside={detail.communication ? <span className="text-caption text-fg-subtle">{`Publiée à ${formatTime(detail.communication.publishedAt)}`}</span> : undefined}
          >
            {detail.communication ? (
              <>
                <p className="py-1 text-body">{detail.communication.message}</p>
                <div className="pt-2">
                  <KeyValueList
                    items={[
                      { label: 'Diffusion', value: detail.communication.diffusion },
                      { label: 'Prochain point', value: detail.communication.nextUpdate },
                    ]}
                  />
                </div>
              </>
            ) : (
              <EmptyLine>Aucun message publié aux organisations.</EmptyLine>
            )}
          </Section>
          <Section id="impactes" title="Modules impactés">
            {detail.impacted.length === 0 ? (
              <EmptyLine>Aucun module impacté.</EmptyLine>
            ) : (
              <ul>
                {detail.impacted.map((module) => (
                  <ListRow
                    key={module.id}
                    title={module.name}
                    detail={module.detail}
                    trailing={<Badge tone="warning">Impacté</Badge>}
                  />
                ))}
              </ul>
            )}
          </Section>
          {detail.runbook ? (
            <Button variant="secondary" onClick={() => { setDialog('runbook'); }}>
              <Icon icon={BookOpen} />
              {`Voir le runbook ${detail.runbook.code}`}
            </Button>
          ) : null}
        </div>
      </div>

      <NoteDialog
        open={dialog === 'note'}
        onOpenChange={close}
        onSave={async (text) => {
          await addNote.mutateAsync({ text });
          notify.success('Note ajoutée', 'La note figure dans la chronologie.');
        }}
      />
      <UpdateDialog
        open={dialog === 'update'}
        onOpenChange={close}
        onPublish={async (input) => {
          await publish.mutateAsync(input);
          notify.success('Mise à jour publiée', 'Les organisations voient le bandeau d’information.');
        }}
      />
      <ConfirmDialog
        open={dialog === 'resolve'}
        onOpenChange={close}
        title={`Résoudre ${incident.code}`}
        description="L’incident passe à Résolu et les modules concernés reviennent à Opérationnel. L’action est consignée au journal d’audit."
        confirmLabel="Résoudre l’incident"
        onConfirm={async () => {
          await resolve.mutateAsync();
          notify.success('Incident résolu', 'La résolution est consignée au journal d’audit.');
        }}
      />
      {detail.runbook ? (
        <Dialog open={dialog === 'runbook'} onOpenChange={close}>
          <DialogContent title={`${detail.runbook.code}, ${detail.runbook.title}`} description={`Procédure d’exploitation · dernier relevé ${formatDateTime(incident.openedAt)}`}>
            <ol className="flex list-decimal flex-col gap-2 px-4 py-3 pl-8 text-body">
              {detail.runbook.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function NoteDialog({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; onSave: (text: string) => Promise<void> }) {
  const form = useZodForm(incidentNoteInputSchema, { text: '' });
  const [failure, setFailure] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState } = form;
  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await onSave(values.text);
      reset();
      onOpenChange(false);
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });
  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
          setFailure(null);
        }
        onOpenChange(next);
      }}
      title="Ajouter une note"
      description="La note est visible des opérateurs dans la chronologie, pas des organisations."
      submitLabel="Ajouter la note"
      pending={formState.isSubmitting}
      failure={failure}
      onSubmit={(event) => void submit(event)}
    >
      <Textarea label="Note" placeholder="Deux workers ajoutés, file en baisse" rows={3} error={formState.errors.text?.message} {...register('text')} />
    </FormDialog>
  );
}

function UpdateDialog({
  open,
  onOpenChange,
  onPublish,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPublish: (input: { message: string; nextUpdate: string }) => Promise<void>;
}) {
  const form = useZodForm(incidentUpdateInputSchema, { message: '', nextUpdate: '' });
  const [failure, setFailure] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState } = form;
  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await onPublish(values);
      reset();
      onOpenChange(false);
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });
  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
          setFailure(null);
        }
        onOpenChange(next);
      }}
      title="Publier une mise à jour"
      description="Le message est affiché en bandeau aux organisations concernées."
      submitLabel="Publier"
      pending={formState.isSubmitting}
      failure={failure}
      onSubmit={(event) => void submit(event)}
    >
      <Textarea
        label="Message aux organisations"
        placeholder="Les e-mails sont envoyés avec quelques minutes de retard. Aucun message n’est perdu."
        rows={4}
        error={formState.errors.message?.message}
        {...register('message')}
      />
      <TextField label="Prochain point" placeholder="22:00" error={formState.errors.nextUpdate?.message} {...register('nextUpdate')} />
    </FormDialog>
  );
}
