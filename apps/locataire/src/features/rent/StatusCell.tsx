import { StatusBadge } from '@/components/StatusBadge';
import type { Installment } from '@/tenant/rentModel';
import { INSTALLMENT_STATUS_VIEW } from '@/tenant/rentLabels';

export function StatusCell({ item }: { item: Pick<Installment, 'status' | 'isOverdue'> }) {
  const view = INSTALLMENT_STATUS_VIEW[item.status];
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <StatusBadge tone={view.tone}>{view.label}</StatusBadge>
      {item.isOverdue ? <StatusBadge tone="danger">En retard</StatusBadge> : null}
    </span>
  );
}
