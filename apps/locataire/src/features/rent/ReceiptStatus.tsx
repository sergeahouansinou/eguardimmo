import { StatusBadge } from '@/components/StatusBadge';

export function ReceiptStatus({ isVoid }: { isVoid: boolean }) {
  return isVoid ? <StatusBadge tone="danger">Annulée</StatusBadge> : <StatusBadge tone="success">Valable</StatusBadge>;
}
