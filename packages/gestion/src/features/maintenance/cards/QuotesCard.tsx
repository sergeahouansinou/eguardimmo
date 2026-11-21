import { Badge, Button } from '@eguardimmo/ui';
import { FilePlus2, Gavel } from 'lucide-react';
import { ActionMenu, NoRows, SectionCard } from '../../locataires/kit';
import type { ActionItem } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { formatQuantity, formatRate } from '../amounts';
import { approvalBadge, moneyText, quoteBadge, quoteKindLabel } from '../labels';
import type { Approval, InterventionDetail, Quote } from '../model';
import { useRowAction } from './rowActions';

export function QuotesCard({
  intervention,
  canAdd,
  canWrite,
  onAdd,
  onDecide,
}: {
  intervention: InterventionDetail;
  canAdd: boolean;
  canWrite: boolean;
  onAdd: () => void;
  onDecide: (approval: Approval) => void;
}) {
  const run = useRowAction();
  const quoteItems = (quote: Quote): ActionItem[] => {
    if (!canWrite) return [];
    return [
      ...(quote.status === 'received' ? [{ id: 'submit', label: 'Soumettre au mandant', onSelect: () => { run('Devis soumis au mandant', (source) => source.submitQuote(intervention.id, quote.id)); } }] : []),
      ...(quote.status === 'submitted' ? [
        { id: 'accept', label: 'Marquer accepté', onSelect: () => { run('Devis accepté', (source) => source.acceptQuote(intervention.id, quote.id)); } },
        { id: 'refuse', label: 'Marquer refusé', tone: 'danger' as const, onSelect: () => { run('Devis refusé', (source) => source.refuseQuote(intervention.id, quote.id)); } },
      ] : []),
    ];
  };
  const approvalItems = (approval: Approval): ActionItem[] =>
    canWrite && approval.status === 'pending'
      ? [
          { id: 'decide', label: 'Enregistrer la décision du mandant', onSelect: () => { onDecide(approval); } },
          { id: 'withdraw', label: 'Retirer la demande', tone: 'danger', separatorBefore: true, onSelect: () => { run('Demande d’accord retirée', (source) => source.withdrawApproval(intervention.id, approval.id)); } },
        ]
      : [];

  return (
    <SectionCard
      id="devis"
      title="Devis et accord du mandant"
      aside={canAdd ? <Button variant="secondary" size="sm" onClick={onAdd}><FilePlus2 aria-hidden className="size-4" />Enregistrer un devis</Button> : undefined}
    >
      {intervention.quotes.length === 0 && intervention.approvals.length === 0 ? <NoRows>Aucun devis enregistré.</NoRows> : null}
      <ul className="flex flex-col">
        {intervention.quotes.map((quote) => {
          const items = quoteItems(quote);
          return (
            <li key={quote.id} className="flex flex-col gap-1 border-t border-line py-2 first:border-t-0">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <b className="text-body-strong text-fg">{`${quoteKindLabel[quote.kind]} ${quote.reference}`}</b>
                <span className="flex items-center gap-1">
                  <Badge tone={quoteBadge[quote.status].tone}>{quoteBadge[quote.status].label}</Badge>
                  {items.length > 0 ? <ActionMenu label={`Actions pour le devis ${quote.reference}`} items={items} /> : null}
                </span>
              </span>
              <span className="text-caption text-fg-subtle">{`Émis le ${formatDateFr(quote.issuedOn)} · ${moneyText(quote.totalNet)} HT · ${moneyText(quote.totalGross)} TTC`}</span>
              <ul className="text-caption text-fg-muted">
                {quote.lines.map((line) => (
                  <li key={line.position}>{`${formatQuantity(line.quantityMilli)} ${line.unit ?? ''} ${line.label} · ${formatRate(line.taxRatePcm)}`.replace(/\s+/g, ' ')}</li>
                ))}
              </ul>
            </li>
          );
        })}
        {intervention.approvals.map((approval) => {
          const items = approvalItems(approval);
          return (
            <li key={approval.id} className="flex flex-col gap-1 border-t border-line py-2">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <b className="inline-flex items-center gap-1 text-body-strong text-fg"><Gavel aria-hidden className="size-4" />{`Accord demandé : ${moneyText(approval.amount)}`}</b>
                <span className="flex items-center gap-1">
                  <Badge tone={approvalBadge[approval.status].tone}>{approvalBadge[approval.status].label}</Badge>
                  {items.length > 0 ? <ActionMenu label="Actions pour la demande d’accord" items={items} /> : null}
                </span>
              </span>
              <span className="text-caption text-fg-subtle">
                {approval.status === 'pending' ? `À décider avant le ${formatDateFr(approval.decideBefore)}` : `Décision du ${formatDateFr(approval.decidedAt)}${approval.decidedVia === 'agency_recorded' ? ' enregistrée par l’agence' : ' par le mandant'}`}
                {approval.ceilingAmount ? ` · plafond ${moneyText(approval.ceilingAmount)}` : ''}
              </span>
              {approval.comment ? <span className="text-caption text-fg-muted">{approval.comment}</span> : null}
              {approval.proofFileId ? <span className="text-caption text-fg-muted">Pièce écrite jointe au dossier.</span> : null}
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
