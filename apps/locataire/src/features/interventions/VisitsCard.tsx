'use client';

import { Button, Icon } from '@eguardimmo/ui';
import { CalendarClock, Check } from 'lucide-react';
import { useState } from 'react';
import { FailureAlert } from '@/components/FailureAlert';
import { useFlash } from '@/components/flash';
import { SectionCard } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate, formatWeekdayDate } from '@/lib/dates';
import { INTERVENTION_WORDING } from '@/tenant/interventionErrors';
import { SLOT_LABEL, VISIT_STATUS_VIEW } from '@/tenant/interventionLabels';
import { useConfirmVisit } from '@/tenant/interventionQueries';
import type { InterventionVisit, TenantIntervention } from '@/tenant/interventionModel';
import { RescheduleDialog } from './RescheduleDialog';

function VisitRow({ intervention, visit }: { intervention: TenantIntervention; visit: InterventionVisit }) {
  const confirm = useConfirmVisit();
  const show = useFlash((state) => state.show);
  const [rescheduling, setRescheduling] = useState(false);
  const view = VISIT_STATUS_VIEW[visit.status];
  const when = `${formatWeekdayDate(visit.scheduledOn)}, ${SLOT_LABEL[visit.slot].toLowerCase()}`;
  return (
    <li className="flex flex-col gap-2 border-b border-line py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-block-title">{when}</span>
        <StatusBadge tone={view.tone}>{view.label}</StatusBadge>
      </div>
      <p className="text-body text-fg-muted">{visit.presenceRequired ? 'Votre présence est requise.' : 'Votre présence n’est pas requise.'}</p>
      {visit.status === 'confirmed' && visit.contactName !== null ? (
        <p className="text-body text-fg-muted">
          Intervenant : {visit.contactName}
          {visit.contactPhone === null ? null : (
            <>
              {' · '}
              <a href={`tel:${visit.contactPhone.replace(/\s/g, '')}`} className="text-action-on-subtle underline underline-offset-3">
                {visit.contactPhone}
              </a>
            </>
          )}
        </p>
      ) : null}
      {visit.status === 'reschedule_requested' && visit.requestedOn !== null && visit.requestedSlot !== null ? (
        <p className="text-body text-fg-muted">
          Vous avez demandé le {formatDate(visit.requestedOn)}, {SLOT_LABEL[visit.requestedSlot].toLowerCase()}. Votre gestionnaire vous répondra : le rendez-vous ne change qu’avec son accord.
        </p>
      ) : null}
      {visit.status === 'proposed' ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            loading={confirm.isPending}
            onClick={() => {
              confirm.mutate(
                { id: intervention.id, visitId: visit.id },
                { onSuccess: () => { show({ tone: 'success', title: 'Rendez-vous confirmé', detail: when, path: `/interventions/${intervention.id}` }); } },
              );
            }}
          >
            <Icon icon={Check} />
            Confirmer ce rendez-vous
          </Button>
          <Button size="sm" variant="secondary" onClick={() => { setRescheduling(true); }}>
            <Icon icon={CalendarClock} />
            Demander un autre créneau
          </Button>
        </div>
      ) : null}
      {confirm.isError ? <FailureAlert title="Le rendez-vous n’a pas pu être confirmé" error={confirm.error} wording={INTERVENTION_WORDING} /> : null}
      <RescheduleDialog intervention={intervention} visit={visit} open={rescheduling} onOpenChange={setRescheduling} />
    </li>
  );
}

export function VisitsCard({ intervention }: { intervention: TenantIntervention }) {
  const visits = intervention.visits;
  return (
    <SectionCard id="iv-rdv" title="Détail du rendez-vous">
      {visits.length === 0 ? (
        <p className="text-body text-fg-muted">Aucun rendez-vous fixé pour l’instant. Vous serez prévenu dès qu’un intervenant sera prévu.</p>
      ) : (
        <ul>
          {visits.map((visit) => (
            <VisitRow key={visit.id} intervention={intervention} visit={visit} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
