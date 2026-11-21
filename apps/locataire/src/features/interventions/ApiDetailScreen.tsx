'use client';

import { Alert, Button, Icon, StatCard } from '@eguardimmo/ui';
import { CircleCheck, Clock, XCircle } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useFlash } from '@/components/flash';
import { PageHeader } from '@/components/PageHeader';
import { KeyValueList, ListRow, SectionCard } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate, formatDateTime } from '@/lib/dates';
import { describeFailure } from '@/tenant/errors';
import { INTERVENTION_WORDING } from '@/tenant/interventionErrors';
import { SLOT_LABEL, STATE_VIEW, declineReasonLabel, isOpen, nextVisit, urgencyLabel } from '@/tenant/interventionLabels';
import { useCancelIntervention, useIntervention } from '@/tenant/interventionQueries';
import type { TenantIntervention } from '@/tenant/interventionModel';
import { DetailState } from '../rent/NotFound';
import { CommentCard } from './CommentCard';
import { PhotosCard } from './PhotosCard';
import { VisitsCard } from './VisitsCard';

export function ApiDetailScreen({ id }: { id: string }) {
  const query = useIntervention(id);
  return (
    <DetailState
      query={query}
      failureTitle="La demande n’a pas pu être chargée"
      notFound={{ title: 'Demande introuvable', backHref: '/interventions', backLabel: 'Revenir aux interventions' }}
    >
      {(item) => <Detail item={item} />}
    </DetailState>
  );
}

function Detail({ item }: { item: TenantIntervention }) {
  const view = STATE_VIEW[item.state];
  const visit = nextVisit(item);
  const [cancelling, setCancelling] = useState(false);
  const cancel = useCancelIntervention();
  const show = useFlash((state) => state.show);
  const open = isOpen(item.state);
  const path = `/interventions/${item.id}`;

  return (
    <>
      <PageHeader
        title={item.title}
        crumbs={[{ label: 'Interventions', href: '/interventions' }, { label: item.reference }]}
        badge={<StatusBadge tone={view.tone}>{view.label}</StatusBadge>}
        subtitle={`Signalée le ${formatDate(item.reportedOn)} · ${item.place}${item.nature.label ? ` · ${item.nature.label}` : ''}`}
        actions={
          item.cancellable ? (
            <Button variant="secondary" onClick={() => { setCancelling(true); }}>
              <Icon icon={XCircle} />
              Annuler la demande
            </Button>
          ) : null
        }
      />
      {item.state === 'declined' && item.decline !== null ? (
        <Alert tone="warning" title="Demande classée sans suite">
          {declineReasonLabel(item.decline.reason)}
          {item.decline.note ? ` : ${item.decline.note}` : ''}
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="État" value={view.label} />
        <StatCard label="Rendez-vous" value={visit ? formatDate(visit.scheduledOn) : '—'}>
          <span className="text-caption text-fg-subtle">{visit ? SLOT_LABEL[visit.slot] : 'Aucun rendez-vous fixé'}</span>
        </StatCard>
        <StatCard label={item.completedOn ? 'Terminée le' : 'Signalée le'} value={formatDate(item.completedOn ?? item.reportedOn)} />
      </div>
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard id="iv-chrono" title="Chronologie">
          {item.events === null || item.events.length === 0 ? (
            <p className="py-2 text-body text-fg-subtle">Aucun événement pour le moment.</p>
          ) : (
            <ol>
              {item.events.map((event) => (
                <ListRow
                  key={event.id}
                  icon={event.author === 'tenant' ? Clock : CircleCheck}
                  tone={event.author === 'tenant' ? 'neutral' : 'success'}
                  title={event.text}
                  detail={`${event.author === 'tenant' ? 'Vous' : 'Votre gestionnaire'} · ${formatDateTime(event.createdAt)}`}
                />
              ))}
            </ol>
          )}
        </SectionCard>
        <div className="flex min-w-0 flex-col gap-3">
          <VisitsCard intervention={item} />
          <SectionCard id="iv-signalement" title="Votre signalement">
            <KeyValueList
              labelWidth="6rem"
              items={[
                { label: 'Type', value: item.nature.label ?? '—' },
                { label: 'Lieu', value: item.room ?? item.place },
                { label: 'Urgence', value: urgencyLabel(item.reportedUrgency) },
                { label: 'Description', value: item.description },
                { label: 'Disponibilités', value: item.availability ?? '—' },
              ]}
            />
          </SectionCard>
        </div>
      </div>
      <PhotosCard id={item.id} files={item.files ?? []} canAdd={open} />
      {open ? <CommentCard id={item.id} /> : null}
      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title="Annuler cette demande ?"
        description="Votre gestionnaire sera prévenu. Vous pourrez signaler de nouveau le problème si besoin."
        confirmLabel="Annuler la demande"
        cancelLabel="Garder la demande"
        loading={cancel.isPending}
        error={cancel.isError ? describeFailure(cancel.error, INTERVENTION_WORDING).message : undefined}
        onConfirm={() => {
          cancel.mutate(item.id, {
            onSuccess: () => {
              setCancelling(false);
              show({ tone: 'success', title: 'Demande annulée', path });
            },
          });
        }}
      />
    </>
  );
}
