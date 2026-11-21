import { Badge, Button } from '@eguardimmo/ui';
import { CalendarPlus } from 'lucide-react';
import { ActionMenu, NoRows, SectionCard } from '../../locataires/kit';
import type { ActionItem } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { slotLabel, visitBadge } from '../labels';
import type { InterventionDetail, Visit } from '../model';
import { useRowAction } from './rowActions';

const OPEN: readonly Visit['status'][] = ['proposed', 'confirmed', 'reschedule_requested'];

export function VisitsCard({ intervention, canAdd, canWrite, onAdd }: { intervention: InterventionDetail; canAdd: boolean; canWrite: boolean; onAdd: () => void }) {
  const run = useRowAction();
  const itemsFor = (visit: Visit): ActionItem[] => {
    if (!canWrite || !OPEN.includes(visit.status)) return [];
    return [
      ...(visit.status === 'confirmed' ? [{ id: 'done', label: 'Marquer effectuée', onSelect: () => { run('Visite marquée effectuée', (source) => source.markVisitDone(intervention.id, visit.id)); } }] : []),
      ...(visit.status === 'proposed' || visit.status === 'reschedule_requested' ? [{ id: 'confirm', label: 'Confirmer pour le locataire', onSelect: () => { run('Visite confirmée', (source) => source.confirmVisit(intervention.id, visit.id)); } }] : []),
      ...(visit.status === 'confirmed' ? [{ id: 'no-show', label: 'Constater une absence', onSelect: () => { run('Absence constatée', (source) => source.markVisitNoShow(intervention.id, visit.id)); } }] : []),
      { id: 'cancel', label: 'Annuler la visite', tone: 'danger' as const, separatorBefore: true, onSelect: () => { run('Visite annulée', (source) => source.cancelVisit(intervention.id, visit.id)); } },
    ];
  };
  return (
    <SectionCard
      id="visites"
      title="Visites"
      aside={canAdd ? <Button variant="secondary" size="sm" onClick={onAdd}><CalendarPlus aria-hidden className="size-4" />Proposer une visite</Button> : undefined}
    >
      {intervention.visits.length === 0 ? <NoRows>Aucune visite planifiée.</NoRows> : null}
      <ul className="flex flex-col">
        {intervention.visits.map((visit) => {
          const items = itemsFor(visit);
          return (
            <li key={visit.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2 first:border-t-0">
              <span className="flex min-w-0 flex-col">
                <b className="text-body-strong text-fg">{`${formatDateFr(visit.scheduledOn)} · ${slotLabel[visit.slot]}`}</b>
                <span className="text-caption text-fg-subtle">
                  {visit.presenceRequired ? 'Présence requise' : 'Présence non requise'}
                  {visit.contactName ? ` · ${visit.contactName}` : ''}
                  {visit.contactPhone ? ` · ${visit.contactPhone}` : ''}
                </span>
                {visit.status === 'reschedule_requested' && visit.requestedOn ? <span className="text-caption text-fg-subtle">{`Report demandé : ${formatDateFr(visit.requestedOn)}${visit.requestedSlot ? ` · ${slotLabel[visit.requestedSlot]}` : ''}`}</span> : null}
              </span>
              <span className="flex items-center gap-1">
                <Badge tone={visitBadge[visit.status].tone}>{visitBadge[visit.status].label}</Badge>
                {items.length > 0 ? <ActionMenu label={`Actions pour la visite du ${formatDateFr(visit.scheduledOn)}`} items={items} /> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
