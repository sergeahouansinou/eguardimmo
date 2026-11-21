import { Badge } from '@eguardimmo/ui';
import { DescriptionList, SectionCard } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { basisLabel, moneyText, originLabel, priorityBadge, responsibilityLabel, urgencyLabel } from '../labels';
import type { InterventionDetail, Term } from '../model';

export function SummaryCard({ intervention, natures }: { intervention: InterventionDetail; natures: readonly Term[] }) {
  const nature = natures.find((term) => term.id === intervention.natureTermId)?.label ?? '—';
  const lot = intervention.unit ? `${intervention.unit.reference}${intervention.unit.propertyName ? ` · ${intervention.unit.propertyName}` : ''}` : '—';
  return (
    <SectionCard id="synthese" title="Synthèse">
      <p className="text-body text-fg">{intervention.description}</p>
      <DescriptionList
        termWidth="150px"
        items={[
          { term: 'Lot', detail: lot },
          { term: 'Nature', detail: nature },
          { term: 'Priorité', detail: <Badge tone={priorityBadge[intervention.priority].tone}>{priorityBadge[intervention.priority].label}</Badge> },
          { term: 'Responsabilité', detail: responsibilityLabel[intervention.responsibility] },
          { term: 'Origine', detail: originLabel[intervention.origin] },
          { term: 'Urgence signalée', detail: intervention.reportedUrgency ? urgencyLabel[intervention.reportedUrgency] : '—' },
          { term: 'Pièce', detail: intervention.room ?? '—' },
          { term: 'Disponibilités', detail: intervention.availability ?? '—' },
          { term: 'Mandant', detail: intervention.mandant?.name ?? '—' },
          { term: 'Locataire', detail: intervention.reporter?.name ?? '—' },
          { term: 'Prestataire', detail: intervention.supplier?.name ?? 'Non assigné' },
          { term: 'Signalée le', detail: formatDateFr(intervention.reportedOn) },
          { term: 'Échéance', detail: formatDateFr(intervention.dueOn) },
          { term: 'Estimation', detail: intervention.estimatedAmount ? moneyText(intervention.estimatedAmount) : '—' },
          { term: 'Plafond du mandat', detail: intervention.ceilingAmount ? moneyText(intervention.ceilingAmount) : '—' },
          { term: 'Engagé', detail: intervention.committedAmount ? moneyText(intervention.committedAmount) : '—' },
          { term: 'Base d’engagement', detail: intervention.approvalBasis ? basisLabel[intervention.approvalBasis] : '—' },
          ...(intervention.emergencyReason ? [{ term: 'Motif d’urgence', detail: intervention.emergencyReason }] : []),
          ...(intervention.declineNote ? [{ term: 'Classement sans suite', detail: intervention.declineNote }] : []),
          ...(intervention.completedOn ? [{ term: 'Terminée le', detail: `${formatDateFr(intervention.completedOn)}${intervention.completionNote ? ` : ${intervention.completionNote}` : ''}` }] : []),
        ]}
      />
    </SectionCard>
  );
}
